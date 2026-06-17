import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../jwt-payload.interface';

/** Extracts the authenticated user (set by `JwtStrategy.validate`) from the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
