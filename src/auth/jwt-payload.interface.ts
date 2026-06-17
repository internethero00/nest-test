export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

/** Authenticated user plus the raw refresh token, set by the refresh strategy. */
export interface AuthUserWithRefreshToken extends AuthUser {
  refreshToken: string;
}
