import { ApiKeyGuard } from '../api-key.guard';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { CryptoUtil } from '../../utils/crypto.util';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let mockDataSource: any;
  let mockTenantRepo: any;

  beforeEach(() => {
    mockTenantRepo = {
      findOne: jest.fn(),
    };
    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockTenantRepo),
    };
    guard = new ApiKeyGuard(mockDataSource);
  });

  function createMockContext(headers: Record<string, string>): { context: ExecutionContext; request: any } {
    const request: any = { headers };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  it('should throw UnauthorizedException if x-api-key header is missing', async () => {
    const { context } = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Missing or invalid X-API-Key header'),
    );
  });

  it('should throw UnauthorizedException if tenant not found or inactive', async () => {
    const { context } = createMockContext({ 'x-api-key': 'dsp_live_invalid' });
    mockTenantRepo.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or inactive API Key'),
    );
  });

  it('should attach tenant to request and return true on valid active key', async () => {
    const rawKey = 'dsp_live_1234567890abcdef';
    const keyHash = CryptoUtil.hashApiKey(rawKey);
    const mockTenant = { id: 'tenant-123', name: 'Test Store', apiKeyHash: keyHash, isActive: true };

    const { context, request } = createMockContext({ 'x-api-key': rawKey });
    mockTenantRepo.findOne.mockResolvedValue(mockTenant);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.tenant).toEqual(mockTenant);
  });
});
