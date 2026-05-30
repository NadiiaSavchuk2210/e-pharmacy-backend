import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { OptionalAuthenticatedRequest } from '../types/authenticated-request.type';
import { UserService } from '../user.service';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<OptionalAuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return true;
    }

    const [scheme, token] = authHeader.trim().split(/\s+/);

    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Unauthorized');
    }

    const user = this.userService.verifyToken(token);

    if (user.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    request.user = user;
    request.token = token;
    return true;
  }
}
