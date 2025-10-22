import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Request,
} from '@nestjs/common'

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const authHeader =
      request.headers['authorization'] || request.headers['Authorization']

    if (authHeader === process.env.AUTH_HEADER) {
      return true
    }
    throw new UnauthorizedException('Invalid or missing authorization header')
  }
}
