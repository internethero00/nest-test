import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { REFRESH_COOKIE_NAME } from '../refresh-cookie';
import {
  AuthUserWithRefreshToken,
  JwtPayload,
} from '../jwt-payload.interface';

/** Reads the refresh token from the httpOnly cookie. */
const cookieExtractor = (req: Request): string | null =>
  (req?.cookies as Record<string, string> | undefined)?.[
    REFRESH_COOKIE_NAME
  ] ?? null;

/**
 * Validates the refresh token (read from the httpOnly cookie) against the
 * refresh secret, and forwards the raw token so the service can compare it to
 * the stored hash.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey:
        config.get<string>('JWT_REFRESH_SECRET') ??
        'change_me_too_in_production',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): AuthUserWithRefreshToken {
    const refreshToken = cookieExtractor(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }
    return { id: payload.sub, email: payload.email, refreshToken };
  }
}
