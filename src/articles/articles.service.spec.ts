import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Article } from './article.entity';
import { ArticlesService, PaginatedArticles } from './articles.service';
import { QueryArticlesDto } from './dto/query-articles.dto';

const VERSION_KEY = 'articles:list:version';

const makeArticle = (overrides: Partial<Article> = {}): Article =>
  ({
    id: 'a1',
    title: 'Title',
    description: 'Description',
    publicationDate: new Date('2026-01-01T00:00:00Z'),
    authorId: 'owner',
    createdAt: new Date(),
    updatedAt: new Date(),
    author: undefined,
    ...overrides,
  }) as Article;

const makeQuery = (
  overrides: Partial<QueryArticlesDto> = {},
): QueryArticlesDto => ({ page: 1, limit: 10, order: 'DESC', ...overrides });

describe('ArticlesService', () => {
  let service: ArticlesService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findAndCount: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: getRepositoryToken(Article), useValue: repo },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get(ArticlesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('persists the article with the given author and bumps the list version', async () => {
      const created = makeArticle();
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);
      cache.get.mockResolvedValue(null); // version miss

      const result = await service.create('owner', {
        title: 'Title',
        description: 'Description',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: 'owner', title: 'Title' }),
      );
      expect(result).toBe(created);
      // list version was written (invalidates cached lists)
      expect(cache.set).toHaveBeenCalledWith(
        VERSION_KEY,
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('defaults publicationDate to now when omitted', async () => {
      repo.create.mockImplementation((x) => x);
      repo.save.mockImplementation((x) => Promise.resolve(x));
      cache.get.mockResolvedValue(1);

      await service.create('owner', { title: 'T', description: 'D' });

      const arg = repo.create.mock.calls[0][0];
      expect(arg.publicationDate).toBeInstanceOf(Date);
    });
  });

  describe('findAll', () => {
    it('returns the cached result without querying the database', async () => {
      const cached: PaginatedArticles = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      cache.get.mockImplementation((key: string) =>
        key === VERSION_KEY ? 2 : cached,
      );

      const result = await service.findAll(makeQuery());

      expect(result).toBe(cached);
      expect(repo.findAndCount).not.toHaveBeenCalled();
    });

    it('queries the database on a cache miss and caches the result', async () => {
      const article = makeArticle();
      cache.get.mockImplementation((key: string) =>
        key === VERSION_KEY ? 2 : null,
      );
      repo.findAndCount.mockResolvedValue([[article], 1]);

      const result = await service.findAll(makeQuery({ page: 2, limit: 5 }));

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
          order: { publicationDate: 'DESC' },
        }),
      );
      expect(result.meta).toEqual({
        total: 1,
        page: 2,
        limit: 5,
        totalPages: 1,
      });
      expect(cache.set).toHaveBeenCalled();
    });

    it('applies author and date-range filters', async () => {
      cache.get.mockImplementation((key: string) =>
        key === VERSION_KEY ? 1 : null,
      );
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(
        makeQuery({
          authorId: 'author-1',
          publishedFrom: '2026-01-01',
          publishedTo: '2026-12-31',
        }),
      );

      const where = repo.findAndCount.mock.calls[0][0].where;
      expect(where.authorId).toBe('author-1');
      expect(where.publicationDate).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('returns the cached article without hitting the database', async () => {
      const cached = makeArticle();
      cache.get.mockResolvedValue(cached);

      const result = await service.findOne('a1');

      expect(result).toBe(cached);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('loads from the database and caches on a miss', async () => {
      const article = makeArticle();
      cache.get.mockResolvedValue(null);
      repo.findOne.mockResolvedValue(article);

      const result = await service.findOne('a1');

      expect(result).toBe(article);
      expect(cache.set).toHaveBeenCalledWith('article:a1', article);
    });

    it('throws NotFoundException when the article does not exist', async () => {
      cache.get.mockResolvedValue(null);
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('throws ForbiddenException when the user is not the author', async () => {
      repo.findOne.mockResolvedValue(makeArticle({ authorId: 'owner' }));

      await expect(
        service.update('a1', 'someone-else', { title: 'New' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('updates fields, saves and invalidates the cache for the author', async () => {
      const article = makeArticle({ authorId: 'owner' });
      repo.findOne.mockResolvedValue(article);
      repo.save.mockImplementation((x) => Promise.resolve(x));
      cache.get.mockResolvedValue(3); // for the version bump

      const result = await service.update('a1', 'owner', {
        title: 'New title',
      });

      expect(result.title).toBe('New title');
      expect(cache.del).toHaveBeenCalledWith('article:a1');
      expect(cache.set).toHaveBeenCalledWith(
        VERSION_KEY,
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when the user is not the author', async () => {
      repo.findOne.mockResolvedValue(makeArticle({ authorId: 'owner' }));

      await expect(service.remove('a1', 'someone-else')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('removes the article and invalidates the cache for the author', async () => {
      const article = makeArticle({ authorId: 'owner' });
      repo.findOne.mockResolvedValue(article);
      cache.get.mockResolvedValue(3);

      await service.remove('a1', 'owner');

      expect(repo.remove).toHaveBeenCalledWith(article);
      expect(cache.del).toHaveBeenCalledWith('article:a1');
    });
  });
});
