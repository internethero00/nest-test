import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
  constructor(
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
  ) {}

  /** Create an article authored by the given user. */
  create(authorId: string, dto: CreateArticleDto): Promise<Article> {
    const article = this.articlesRepository.create({
      title: dto.title,
      description: dto.description,
      publicationDate: dto.publicationDate
        ? new Date(dto.publicationDate)
        : new Date(),
      authorId,
    });
    return this.articlesRepository.save(article);
  }

  /** List articles with pagination and optional filtering by author / publication date. */
  async findAll(query: QueryArticlesDto): Promise<PaginatedArticles> {
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

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Fetch a single article or throw 404. */
  async findOne(id: string): Promise<Article> {
    const article = await this.articlesRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article ${id} not found`);
    }
    return article;
  }

  /** Update an article. Only the author may do so. */
  async update(
    id: string,
    userId: string,
    dto: UpdateArticleDto,
  ): Promise<Article> {
    const article = await this.findOne(id);
    this.assertOwnership(article, userId);

    if (dto.title !== undefined) article.title = dto.title;
    if (dto.description !== undefined) article.description = dto.description;
    if (dto.publicationDate !== undefined) {
      article.publicationDate = new Date(dto.publicationDate);
    }

    return this.articlesRepository.save(article);
  }

  async remove(id: string, userId: string): Promise<void> {
    const article = await this.findOne(id);
    this.assertOwnership(article, userId);
    await this.articlesRepository.remove(article);
  }

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
