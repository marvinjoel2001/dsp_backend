import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CryptoUtil } from '../utils/crypto.util';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('Missing or invalid X-API-Key header');
    }

    const keyHash = CryptoUtil.hashApiKey(apiKey);
    const tenantRepo = this.dataSource.getRepository('tenants');
    const tenant = await tenantRepo.findOne({
      where: { apiKeyHash: keyHash, isActive: true },
    });

    if (!tenant) {
      throw new UnauthorizedException('Invalid or inactive API Key');
    }

    request.tenant = tenant;
    return true;
  }
}
