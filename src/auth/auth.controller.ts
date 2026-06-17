import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthResult, AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import {
  buildRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
} from './refresh-cookie';
import type {
  AuthUser,
  AuthUserWithRefreshToken,
} from './jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respondWithTokens(await this.authService.register(dto), res);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respondWithTokens(await this.authService.login(dto), res);
  }

  /**
   * Exchange the refresh token (httpOnly cookie) for a fresh access/refresh
   * pair (rotation). The token is read and verified by the refresh guard.
   */
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(JwtRefreshGuard)
  async refresh(
    @CurrentUser() user: AuthUserWithRefreshToken,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respondWithTokens(
      await this.authService.refresh(user.id, user.refreshToken),
      res,
    );
  }

  /** Server-side logout: invalidates the stored refresh token and clears the cookie. */
  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.id);
    res.clearCookie(REFRESH_COOKIE_NAME, buildRefreshCookieOptions(this.config));
    return { success: true };
  }

  /** Returns the currently authenticated user (useful for verifying a token). */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  /** Sets the refresh token as an httpOnly cookie and returns the rest in the body. */
  private respondWithTokens(result: AuthResult, res: Response) {
    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      buildRefreshCookieOptions(this.config),
    );
    return { accessToken: result.accessToken, user: result.user };
  }
}
