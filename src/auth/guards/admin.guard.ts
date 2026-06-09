import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Simple guard that allows access only to users with the 'admin' role.
 * Assumes that a preceding authentication guard (e.g., JwtAuthGuard) has
 * attached a `user` object to the request with a `role` property.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    // If no user or role is missing, deny access.
    return !!user && user.role === 'admin';
  }
}
