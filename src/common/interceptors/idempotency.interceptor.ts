import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

// In-memory or Redis-based idempotency cache
const idempotencyStore = new Map<string, { response: any; timestamp: number }>();

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return next.handle();
    }

    const cached = idempotencyStore.get(idempotencyKey);
    if (cached) {
      // Return cached response if within 24 hours
      if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
        return of(cached.response);
      }
    }

    return next.handle().pipe(
      tap((data) => {
        idempotencyStore.set(idempotencyKey, {
          response: data,
          timestamp: Date.now(),
        });
      }),
    );
  }
}
