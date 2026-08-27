import { Test, TestingModule } from '@nestjs/testing';
import { TenantsController } from '../tenants.controller';
import { TenantsService } from '../tenants.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('TenantsController', () => {
  let controller: TenantsController;
  let service: TenantsService;

  const mockTenantsService = {
    createTenant: jest.fn(),
    getAllTenants: jest.fn(),
    getTenantById: jest.fn(),
    regenerateApiKey: jest.fn(),
    updateWebhookConfig: jest.fn(),
    toggleTenantStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: mockTenantsService,
        },
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
    service = module.get<TenantsService>(TenantsService);
    jest.clearAllMocks();
  });

  describe('createTenant', () => {
    it('should create and return tenant with raw API key', async () => {
      const dto = { name: 'SuperEats Bolivia', email: 'api@supereats.bo' };
      const expected = {
        id: 'tenant-1',
        ...dto,
        apiKeyRaw: 'dsp_live_1234567890abcdef',
        apiKeyMasked: 'dsp_live_123...cdef',
      };
      mockTenantsService.createTenant.mockResolvedValue(expected);

      const result = await controller.createTenant(dto);
      expect(result).toEqual(expected);
      expect(service.createTenant).toHaveBeenCalledWith(dto);
    });

    it('should propagate ConflictException if email exists', async () => {
      const dto = { name: 'SuperEats Bolivia', email: 'api@supereats.bo' };
      mockTenantsService.createTenant.mockRejectedValue(new ConflictException('Email duplicado'));

      await expect(controller.createTenant(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('getAllTenants', () => {
    it('should return an array of tenants', async () => {
      const expected = [{ id: 'tenant-1', name: 'SuperEats' }];
      mockTenantsService.getAllTenants.mockResolvedValue(expected);

      const result = await controller.getAllTenants();
      expect(result).toEqual(expected);
    });
  });

  describe('getTenantById', () => {
    it('should return tenant details if found', async () => {
      const expected = { id: 'tenant-1', name: 'SuperEats' };
      mockTenantsService.getTenantById.mockResolvedValue(expected);

      const result = await controller.getTenantById('tenant-1');
      expect(result).toEqual(expected);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      mockTenantsService.getTenantById.mockRejectedValue(new NotFoundException('No encontrado'));
      await expect(controller.getTenantById('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('regenerateApiKey', () => {
    it('should return newly generated raw and masked API keys', async () => {
      const expected = {
        id: 'tenant-1',
        name: 'SuperEats',
        apiKeyMasked: 'dsp_live_new...9999',
        apiKeyRaw: 'dsp_live_new_full_key_9999',
      };
      mockTenantsService.regenerateApiKey.mockResolvedValue(expected);

      const result = await controller.regenerateApiKey('tenant-1');
      expect(result).toEqual(expected);
    });
  });

  describe('updateWebhook', () => {
    it('should update webhook config', async () => {
      const dto = { webhookUrl: 'https://mysite.com/hook' };
      const expected = { id: 'tenant-1', ...dto };
      mockTenantsService.updateWebhookConfig.mockResolvedValue(expected);

      const result = await controller.updateWebhook('tenant-1', dto);
      expect(result).toEqual(expected);
      expect(service.updateWebhookConfig).toHaveBeenCalledWith('tenant-1', dto);
    });
  });

  describe('toggleStatus', () => {
    it('should toggle tenant active state', async () => {
      const expected = { id: 'tenant-1', isActive: false };
      mockTenantsService.toggleTenantStatus.mockResolvedValue(expected);

      const result = await controller.toggleStatus('tenant-1');
      expect(result).toEqual(expected);
      expect(service.toggleTenantStatus).toHaveBeenCalledWith('tenant-1');
    });
  });
});
