import { IdempotencyInterceptor } from '../idempotency.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new IdempotencyInterceptor();
    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ orderId: 'ord_123', status: 'CREATED' })),
    };
  });

  function createMockContext(headers: Record<string, string>): ExecutionContext {
    const request = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('should pass through without caching when idempotency-key header is absent', (done) => {
    const context = createMockContext({});

    interceptor.intercept(context, mockCallHandler).subscribe((result) => {
      expect(result).toEqual({ orderId: 'ord_123', status: 'CREATED' });
      expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('should execute and cache on first call, and return cached result on second call', (done) => {
    const key = `idem_${Date.now()}_${Math.random()}`;
    const context = createMockContext({ 'idempotency-key': key });

    // First call
    interceptor.intercept(context, mockCallHandler).subscribe((result1) => {
      expect(result1).toEqual({ orderId: 'ord_123', status: 'CREATED' });
      expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);

      // Second call with same idempotency key
      interceptor.intercept(context, mockCallHandler).subscribe((result2) => {
        expect(result2).toEqual({ orderId: 'ord_123', status: 'CREATED' });
        // Handler should NOT be called again
        expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
        done();
      });
    });
  });
});
