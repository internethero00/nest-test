import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(1)
  description: string;

  /** ISO date string; defaults to the current time when omitted. */
  @IsOptional()
  @IsDateString()
  publicationDate?: string;
}
