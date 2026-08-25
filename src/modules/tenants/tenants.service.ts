import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { CryptoUtil } from '../../common/utils/crypto.util';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async createTenant(dto: CreateTenantDto) {
    const existing = await this.tenantRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Ya existe un comercio registrado con este correo electrónico.');
    }

    const { rawKey, keyHash, maskedKey } = CryptoUtil.generateApiKey('dsp_live_');
    const webhookSecret = CryptoUtil.generateWebhookSecret();

    const tenant = this.tenantRepository.create({
      name: dto.name,
      email: dto.email,
      apiKeyHash: keyHash,
      apiKeyMasked: maskedKey,
      webhookUrl: dto.webhookUrl || null,
      webhookSecret,
      isActive: true,
    });

    const saved = await this.tenantRepository.save(tenant);

    return {
      ...saved,
      apiKeyRaw: rawKey, // Se muestra una única vez tras la creación
    };
  }

  async getAllTenants() {
    return this.tenantRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getTenantById(id: string) {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Comercio no encontrado.');
    }
    return tenant;
  }

  async regenerateApiKey(id: string) {
    const tenant = await this.getTenantById(id);
    const { rawKey, keyHash, maskedKey } = CryptoUtil.generateApiKey('dsp_live_');

    tenant.apiKeyHash = keyHash;
    tenant.apiKeyMasked = maskedKey;
    await this.tenantRepository.save(tenant);

    return {
      id: tenant.id,
      name: tenant.name,
      apiKeyMasked: maskedKey,
      apiKeyRaw: rawKey,
    };
  }

  async updateWebhookConfig(id: string, dto: UpdateWebhookDto) {
    const tenant = await this.getTenantById(id);
    tenant.webhookUrl = dto.webhookUrl;
    if (dto.webhookSecret) {
      tenant.webhookSecret = dto.webhookSecret;
    }
    return this.tenantRepository.save(tenant);
  }

  async toggleTenantStatus(id: string) {
    const tenant = await this.getTenantById(id);
    tenant.isActive = !tenant.isActive;
    return this.tenantRepository.save(tenant);
  }
}
