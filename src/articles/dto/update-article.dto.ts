import { PartialType } from '@nestjs/mapped-types';
import { CreateArticleDto } from './create-article.dto';

/** All fields optional; only provided fields are updated. */
export class UpdateArticleDto extends PartialType(CreateArticleDto) {}
