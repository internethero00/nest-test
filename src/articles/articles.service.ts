import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import {
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { Article } from './article.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { QueryArticlesDto } from './dto/query-articles.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

export interface PaginatedArticles {
  data: Article[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class ArticlesService {
  /** Key for a single cached article. */
  private readonly singleKey = (id: string) => `article:${id}`;

  /**
   * Monotonic version embedded in every list cache key. Bumping it on any write
   * makes all previously cached lists unreachable (they expire on their own
   * TTL), which invalidates lists without scanning Redis by pattern.
   */
  private readonly LIST_VERSION_KEY = 'articles:list:version';
  private readonly VERSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  /** Create an article authored by the given user. */
  async create(authorId: string, dto: CreateArticleDto): Promise<Article> {
    const article = this.articlesRepository.create({
      title: dto.title,
      description: dto.description,
      publicationDate: dto.publicationDate
        ? new Date(dto.publicationDate)
        : new Date(),
      authorId,
    });
    const saved = await this.articlesRepository.save(article);
    // A new article changes list results, so invalidate cached lists.
    await this.bumpListVersion();
    return saved;
  }

  /** List articles with pagination and optional filtering; result is cached. */
  async findAll(query: QueryArticlesDto): Promise<PaginatedArticles> {
    const version = await this.getListVersion();
    const cacheKey = this.listKey(version, query);

    const cached = await this.cache.get<PaginatedArticles>(cacheKey);
    if (cached) {
      return cached;
    }

    const { page, limit, order } = query;
    const where: FindOptionsWhere<Article> = {};
    if (query.authorId) {
      where.authorId = query.authorId;
    }
    const dateFilter = this.buildDateFilter(
      query.publishedFrom,
      query.publishedTo,
    );
    if (dateFilter) {
      where.publicationDate = dateFilter;
    }

    const [data, total] = await this.articlesRepository.findAndCount({
      where,
      order: { publicationDate: order },
      skip: (page - 1) * limit,
      take: limit,
    });

    const result: PaginatedArticles = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cache.set(cacheKey, result);
    return result;
  }

  /** Fetch a single article (cached) or throw 404. */
  async findOne(id: string): Promise<Article> {
    const cacheKey = this.singleKey(id);

    const cached = await this.cache.get<Article>(cacheKey);
    if (cached) {
      return cached;
    }

    const article = await this.loadOne(id);
    await this.cache.set(cacheKey, article);
    return article;
  }

  /** Update an article. Only the author may do so. */
  async update(
    id: string,
    userId: string,
    dto: UpdateArticleDto,
  ): Promise<Article> {
    const article = await this.loadOne(id);
    this.assertOwnership(article, userId);

    if (dto.title !== undefined) article.title = dto.title;
    if (dto.description !== undefined) article.description = dto.description;
    if (dto.publicationDate !== undefined) {
      article.publicationDate = new Date(dto.publicationDate);
    }

    const saved = await this.articlesRepository.save(article);
    await this.invalidate(id);
    return saved;
  }

  /** Delete an article. Only the author may do so. */
  async remove(id: string, userId: string): Promise<void> {
    const article = await this.loadOne(id);
    this.assertOwnership(article, userId);
    await this.articlesRepository.remove(article);
    await this.invalidate(id);
  }

  /** Load an article straight from the database (no cache), or throw 404. */
  private async loadOne(id: string): Promise<Article> {
    const article = await this.articlesRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article ${id} not found`);
    }
    return article;
  }

  /** Drop the single-article cache and invalidate all cached lists. */
  private async invalidate(id: string): Promise<void> {
    await this.cache.del(this.singleKey(id));
    await this.bumpListVersion();
  }

  private async getListVersion(): Promise<number> {
    const version = await this.cache.get<number>(this.LIST_VERSION_KEY);
    if (typeof version === 'number') {
      return version;
    }
    await this.cache.set(this.LIST_VERSION_KEY, 1, this.VERSION_TTL);
    return 1;
  }

  private async bumpListVersion(): Promise<void> {
    const version = await this.getListVersion();
    await this.cache.set(this.LIST_VERSION_KEY, version + 1, this.VERSION_TTL);
  }

  /** Build a deterministic cache key for a list query at a given version. */
  private listKey(version: number, query: QueryArticlesDto): string {
    const parts = {
      page: query.page,
      limit: query.limit,
      order: query.order,
      authorId: query.authorId ?? '',
      from: query.publishedFrom ?? '',
      to: query.publishedTo ?? '',
    };
    return `articles:list:v${version}:${JSON.stringify(parts)}`;
  }

  /** Build a TypeORM operator for a publication date range, or undefined if no bounds. */
  private buildDateFilter(from?: string, to?: string) {
    if (from && to) return Between(new Date(from), new Date(to));
    if (from) return MoreThanOrEqual(new Date(from));
    if (to) return LessThanOrEqual(new Date(to));
    return undefined;
  }

  private assertOwnership(article: Article, userId: string): void {
    if (article.authorId !== userId) {
      throw new ForbiddenException('You are not the author of this article');
    }
  }
}
