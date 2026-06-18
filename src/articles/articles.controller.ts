import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-payload.interface';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { QueryArticlesDto } from './dto/query-articles.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  /** Create an article (authenticated; author is the current user). */
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an article (auth required)' })
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateArticleDto) {
    return this.articlesService.create(user.id, dto);
  }

  /** List articles with pagination and filtering (public). */
  @Get()
  @ApiOperation({ summary: 'List articles with pagination and filtering' })
  findAll(@Query() query: QueryArticlesDto) {
    return this.articlesService.findAll(query);
  }

  /** Get a single article by id (public). */
  @Get(':id')
  @ApiOperation({ summary: 'Get a single article by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.findOne(id);
  }

  /** Update an article (authenticated; author only). */
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an article (author only)' })
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(id, user.id, dto);
  }

  /** Delete an article (authenticated; author only). */
  @Delete(':id')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an article (author only)' })
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.articlesService.remove(id, user.id);
  }
}
