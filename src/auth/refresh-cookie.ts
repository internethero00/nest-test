import { ConfigService } from '@nestjs/config';
import { CookieOptions } from 'express';
import ms, { StringValue } from 'ms';

/** Name of the httpOnly cookie holding the refresh token. */
export const REFRESH_COOKIE_NAME = 'refresh_token';

/**
 * Builds cookie options for the refresh token.
 *
 * - `httpOnly`: not readable from JS (mitigates XSS token theft).
 * - `sameSite: 'lax'`: same-site client, mitigates CSRF.
 * - `secure`: HTTPS-only in production.
 * - `path: '/auth'`: cookie is only sent to the auth endpoints.
 */
export const buildRefreshCookieOptions = (
  config: ConfigService,
): CookieOptions => {
  const expiresIn = config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.get<string>('NODE_ENV') === 'production',
    path: '/auth',
    maxAge: ms(expiresIn as StringValue),
  };
};
