import * as request from 'supertest';
import { INestApplication, NotFoundException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DriversController } from '../../src/modules/drivers/drivers.controller';
import { DriversService } from '../../src/modules/drivers/drivers.service';
import { DriverVerificationStatus } from '../../src/modules/drivers/entities/driver.entity';
import { createTestingApp } from '../test-helper';

describe('Drivers API (e2e)', () => {
  let app: INestApplication;

  const mockDriversService = {
    getAllDrivers: jest.fn(),
    getDriverById: jest.fn(),
    updateProfile: jest.fn(),
    uploadDocuments: jest.fn(),
    updateVerificationStatus: jest.fn(),
    toggleOnlineStatus: jest.fn(),
    getAvailableFeedForDriver: jest.fn(),
    getActiveOrderForDriver: jest.fn(),
    getDriverWallet: jest.fn(),
  };

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [DriversController],
      providers: [
        {
          provide: DriversService,
          useValue: mockDriversService,
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

  describe('GET /v1/drivers', () => {
    it('should return 200 with all drivers list', async () => {
      const list = [{ id: 'd-1', fullName: 'Carlos' }, { id: 'd-2', fullName: 'Juan' }];
      mockDriversService.getAllDrivers.mockResolvedValue(list);

      const res = await request(app.getHttpServer())
        .get('/v1/drivers')
        .expect(200);

      expect(res.body).toEqual(list);
    });
  });

  describe('GET /v1/drivers/:id', () => {
    it('should return 200 with driver profile', async () => {
      const driver = { id: 'd-1', fullName: 'Carlos', isOnline: true };
      mockDriversService.getDriverById.mockResolvedValue(driver);

      const res = await request(app.getHttpServer())
        .get('/v1/drivers/d-1')
        .expect(200);

      expect(res.body).toEqual(driver);
    });

    it('should return 404 when driver not found', async () => {
      mockDriversService.getDriverById.mockRejectedValue(new NotFoundException('Conductor no encontrado.'));

      const res = await request(app.getHttpServer())
        .get('/v1/drivers/d-unknown')
        .expect(404);

      expect(res.body.statusCode).toBe(404);
      expect(res.body.exito).toBe(false);
    });
  });

  describe('PATCH /v1/drivers/:id/profile', () => {
    it('should update driver details and return 200', async () => {
      const updateData = { phone: '+59178945612', vehiclePlate: '5421-XYZ' };
      mockDriversService.updateProfile.mockResolvedValue({ id: 'd-1', ...updateData });

      const res = await request(app.getHttpServer())
        .patch('/v1/drivers/d-1/profile')
        .send(updateData)
        .expect(200);

      expect(res.body.phone).toBe(updateData.phone);
    });
  });

  describe('POST /v1/drivers/:id/documents', () => {
    it('should upload document URLs and set status to PENDING', async () => {
      const docs = { licenseUrl: 'https://cdn.dsp.com/lic.jpg' };
      mockDriversService.uploadDocuments.mockResolvedValue({
        id: 'd-1',
        ...docs,
        verificationStatus: DriverVerificationStatus.PENDING,
      });

      const res = await request(app.getHttpServer())
        .post('/v1/drivers/d-1/documents')
        .send(docs)
        .expect(201);

      expect(res.body.verificationStatus).toBe(DriverVerificationStatus.PENDING);
    });
  });

  describe('PATCH /v1/drivers/:id/verify', () => {
    it('should approve verification status and return 200', async () => {
      mockDriversService.updateVerificationStatus.mockResolvedValue({
        id: 'd-1',
        verificationStatus: DriverVerificationStatus.VERIFIED,
      });

      const res = await request(app.getHttpServer())
        .patch('/v1/drivers/d-1/verify')
        .send({ status: DriverVerificationStatus.VERIFIED })
        .expect(200);

      expect(res.body.verificationStatus).toBe(DriverVerificationStatus.VERIFIED);
    });
  });

  describe('PATCH /v1/drivers/:id/online', () => {
    it('should toggle online status to true and return 200', async () => {
      mockDriversService.toggleOnlineStatus.mockResolvedValue({ id: 'd-1', isOnline: true });

      const res = await request(app.getHttpServer())
        .patch('/v1/drivers/d-1/online')
        .send({ isOnline: true })
        .expect(200);

      expect(res.body.isOnline).toBe(true);
    });

    it('should return 400 when missing isOnline boolean in body', async () => {
      const res = await request(app.getHttpServer())
        .patch('/v1/drivers/d-1/online')
        .send({})
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.exito).toBe(false);
    });

    it('should return 400 when rejected driver tries to go online', async () => {
      mockDriversService.toggleOnlineStatus.mockRejectedValue(
        new BadRequestException('Tu cuenta ha sido rechazada. Revisa tus documentos.'),
      );

      const res = await request(app.getHttpServer())
        .patch('/v1/drivers/d-1/online')
        .send({ isOnline: true })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.mensaje).toContain('rechazada');
    });
  });

  describe('GET /v1/drivers/:id/feed', () => {
    it('should return available orders feed', async () => {
      const feed = [{ id: 'ord_1' }, { id: 'ord_2' }];
      mockDriversService.getAvailableFeedForDriver.mockResolvedValue(feed);

      const res = await request(app.getHttpServer())
        .get('/v1/drivers/d-1/feed')
        .expect(200);

      expect(res.body).toEqual(feed);
    });
  });

  describe('GET /v1/drivers/:id/active-order', () => {
    it('should return active order or null', async () => {
      const active = { id: 'ord_active', status: 'IN_TRANSIT' };
      mockDriversService.getActiveOrderForDriver.mockResolvedValue(active);

      const res = await request(app.getHttpServer())
        .get('/v1/drivers/d-1/active-order')
        .expect(200);

      expect(res.body).toEqual(active);
    });
  });

  describe('GET /v1/drivers/:id/wallet', () => {
    it('should return wallet balance and history', async () => {
      const wallet = { balance: 250.0, currency: 'USD', transactions: [] };
      mockDriversService.getDriverWallet.mockResolvedValue(wallet);

      const res = await request(app.getHttpServer())
        .get('/v1/drivers/d-1/wallet')
        .expect(200);

      expect(res.body).toEqual(wallet);
    });
  });
});
