import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/** Query params for listing articles: pagination, filtering and sorting. */
export class QueryArticlesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  /** Filter by author id. */
  @IsOptional()
  @IsUUID()
  authorId?: string;

  /** Filter: publication date greater than or equal to this ISO date. */
  @IsOptional()
  @IsDateString()
  publishedFrom?: string;

  /** Filter: publication date less than or equal to this ISO date. */
  @IsOptional()
  @IsDateString()
  publishedTo?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order: 'ASC' | 'DESC' = 'DESC';
}
