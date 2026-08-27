import * as request from 'supertest';
import { INestApplication, NotFoundException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TenantsController } from '../../src/modules/tenants/tenants.controller';
import { TenantsService } from '../../src/modules/tenants/tenants.service';
import { createTestingApp } from '../test-helper';

describe('Tenants API (e2e)', () => {
  let app: INestApplication;

  const mockTenantsService = {
    createTenant: jest.fn(),
    getAllTenants: jest.fn(),
    getTenantById: jest.fn(),
    regenerateApiKey: jest.fn(),
    updateWebhookConfig: jest.fn(),
    toggleTenantStatus: jest.fn(),
  };

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: mockTenantsService,
        },
      ],
    });

    const testApp = await createTestingApp(moduleBuilder);
    app = testApp.app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/tenants', () => {
    it('should create tenant and return 201 with raw and masked keys', async () => {
      const payload = {
        name: 'Supermercados Fidalga',
        email: 'b2b@fidalga.com',
        webhookUrl: 'https://api.fidalga.com/webhooks',
      };
      const expectedResponse = {
        id: 't-123',
        ...payload,
        apiKeyRaw: 'dsp_live_abc123xyz',
        apiKeyMasked: 'dsp_live_abc...xyz',
        webhookSecret: 'whsec_789',
        isActive: true,
      };
      mockTenantsService.createTenant.mockResolvedValue(expectedResponse);

      const res = await request(app.getHttpServer())
        .post('/v1/tenants')
        .send(payload)
        .expect(201);

      expect(res.body).toEqual(expectedResponse);
    });

    it('should return 400 when validation fails on invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/tenants')
        .send({ name: 'Fidalga', email: 'not-an-email' })
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        exito: false,
        ruta: '/v1/tenants',
      });
      expect(res.body.detalles).toBeDefined();
    });

    it('should return 409 when email already exists', async () => {
      mockTenantsService.createTenant.mockRejectedValue(
        new ConflictException('Ya existe un comercio registrado con este correo electrónico.'),
      );

      const res = await request(app.getHttpServer())
        .post('/v1/tenants')
        .send({ name: 'Fidalga', email: 'existing@fidalga.com' })
        .expect(409);

      expect(res.body.statusCode).toBe(409);
      expect(res.body.exito).toBe(false);
    });
  });

  describe('GET /v1/tenants', () => {
    it('should return 200 with list of tenants', async () => {
      const list = [{ id: 't-1', name: 'Fidalga' }, { id: 't-2', name: 'Hipermaxi' }];
      mockTenantsService.getAllTenants.mockResolvedValue(list);

      const res = await request(app.getHttpServer())
        .get('/v1/tenants')
        .expect(200);

      expect(res.body).toEqual(list);
    });
  });

  describe('GET /v1/tenants/:id', () => {
    it('should return 200 with tenant detail if exists', async () => {
      const tenant = { id: 't-1', name: 'Fidalga', email: 'admin@fidalga.com' };
      mockTenantsService.getTenantById.mockResolvedValue(tenant);

      const res = await request(app.getHttpServer())
        .get('/v1/tenants/t-1')
        .expect(200);

      expect(res.body).toEqual(tenant);
    });

    it('should return 404 if tenant does not exist', async () => {
      mockTenantsService.getTenantById.mockRejectedValue(new NotFoundException('Comercio no encontrado.'));

      const res = await request(app.getHttpServer())
        .get('/v1/tenants/non-existing')
        .expect(404);

      expect(res.body.statusCode).toBe(404);
      expect(res.body.exito).toBe(false);
    });
  });

  describe('POST /v1/tenants/:id/regenerate-key', () => {
    it('should return 200 with new apiKeyRaw', async () => {
      const updated = {
        id: 't-1',
        name: 'Fidalga',
        apiKeyMasked: 'dsp_live_new...9999',
        apiKeyRaw: 'dsp_live_new_full_key',
      };
      mockTenantsService.regenerateApiKey.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .post('/v1/tenants/t-1/regenerate-key')
        .expect(200);

      expect(res.body).toEqual(updated);
    });
  });

  describe('PUT /v1/tenants/:id/webhooks', () => {
    it('should update webhook url and return 200', async () => {
      const dto = { webhookUrl: 'https://hooks.fidalga.com/receive' };
      mockTenantsService.updateWebhookConfig.mockResolvedValue({ id: 't-1', ...dto });

      const res = await request(app.getHttpServer())
        .put('/v1/tenants/t-1/webhooks')
        .send(dto)
        .expect(200);

      expect(res.body.webhookUrl).toBe(dto.webhookUrl);
    });

    it('should return 400 when webhookUrl is not a valid URL', async () => {
      const res = await request(app.getHttpServer())
        .put('/v1/tenants/t-1/webhooks')
        .send({ webhookUrl: 'not_a_valid_url' })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.exito).toBe(false);
    });
  });

  describe('PATCH /v1/tenants/:id/toggle-status', () => {
    it('should toggle active state and return 200', async () => {
      mockTenantsService.toggleTenantStatus.mockResolvedValue({ id: 't-1', isActive: false });

      const res = await request(app.getHttpServer())
        .patch('/v1/tenants/t-1/toggle-status')
        .expect(200);

      expect(res.body.isActive).toBe(false);
    });
  });
});
