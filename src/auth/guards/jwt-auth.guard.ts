import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Guard that requires a valid JWT in the `Authorization: Bearer` header. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
