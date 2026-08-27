import * as request from 'supertest';
import { INestApplication, UnauthorizedException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthController } from '../../src/modules/auth/auth.controller';
import { AuthService } from '../../src/modules/auth/auth.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { VehicleType } from '../../src/modules/drivers/entities/driver.entity';
import { createTestingApp } from '../test-helper';

describe('Auth API (e2e)', () => {
  let app: INestApplication;

  const mockAuthService = {
    login: jest.fn(),
    registerDriver: jest.fn(),
  };

  const mockJwtGuard = {
    canActivate: jest.fn().mockImplementation((context) => {
      const req = context.switchToHttp().getRequest();
      const auth = req.headers['authorization'];
      if (!auth || !auth.startsWith('Bearer valid_token')) {
        throw new UnauthorizedException('Token JWT ausente o expirado.');
      }
      req.user = { id: 'user-123', email: 'driver@dsp.com', role: 'DRIVER' };
      return true;
    }),
  };

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard);

    const testApp = await createTestingApp(moduleBuilder);
    app = testApp.app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/auth/login', () => {
    it('should return 200 and accessToken on valid login', async () => {
      const loginPayload = { email: 'admin', password: 'admin' };
      const expectedResponse = {
        user: { id: 'admin-master-id', email: 'admin@chiringuito.com', role: 'ADMIN' },
        accessToken: 'jwt_mock_token_123',
      };
      mockAuthService.login.mockResolvedValue(expectedResponse);

      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send(loginPayload)
        .expect(200);

      expect(res.body).toEqual(expectedResponse);
      expect(mockAuthService.login).toHaveBeenCalled();
    });

    it('should return 400 with formatted error when body is invalid or missing fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('statusCode', 400);
      expect(res.body).toHaveProperty('exito', false);
      expect(res.body).toHaveProperty('mensaje');
      expect(res.body).toHaveProperty('detalles');
      expect(Array.isArray(res.body.detalles)).toBe(true);
      expect(res.body).toHaveProperty('ruta', '/v1/auth/login');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('should return 401 when service throws UnauthorizedException', async () => {
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Teléfono o correo no registrado.'));

      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'unknown@dsp.com', password: 'wrong' })
        .expect(401);

      expect(res.body).toMatchObject({
        statusCode: 401,
        exito: false,
        mensaje: 'Teléfono o correo no registrado.',
        ruta: '/v1/auth/login',
      });
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /v1/auth/register-driver', () => {
    it('should return 201 and driver profile with token on valid registration', async () => {
      const registerPayload = {
        fullName: 'Carlos Mendoza',
        phone: '+59170012345',
        email: 'carlos@dsp.com',
        password: 'password2026',
        vehicleType: VehicleType.MOTORCYCLE,
      };

      const expectedResponse = {
        driver: {
          id: 'driver-uuid-1',
          fullName: registerPayload.fullName,
          phone: registerPayload.phone,
          email: registerPayload.email,
        },
        accessToken: 'initial_driver_token',
      };
      mockAuthService.registerDriver.mockResolvedValue(expectedResponse);

      const res = await request(app.getHttpServer())
        .post('/v1/auth/register-driver')
        .send(registerPayload)
        .expect(201);

      expect(res.body).toEqual(expectedResponse);
    });

    it('should return 409 Conflict when driver already exists', async () => {
      mockAuthService.registerDriver.mockRejectedValue(
        new ConflictException('Ya existe un conductor registrado con este correo o teléfono.'),
      );

      const res = await request(app.getHttpServer())
        .post('/v1/auth/register-driver')
        .send({
          fullName: 'Carlos Mendoza',
          phone: '+59170012345',
          email: 'carlos@dsp.com',
          password: 'password2026',
          vehicleType: VehicleType.MOTORCYCLE,
        })
        .expect(409);

      expect(res.body).toMatchObject({
        statusCode: 409,
        exito: false,
        mensaje: 'Ya existe un conductor registrado con este correo o teléfono.',
      });
    });

    it('should return 400 when validation fails (short password or invalid email)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register-driver')
        .send({
          fullName: 'Carlos',
          phone: '123',
          email: 'not-an-email',
          password: '123', // less than 6 chars
          vehicleType: 'HELICOPTER', // not in enum
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.exito).toBe(false);
      expect(res.body.detalles.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('GET /v1/auth/me', () => {
    it('should return 200 with authenticated user when valid token provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', 'Bearer valid_token_123')
        .expect(200);

      expect(res.body).toEqual({
        id: 'user-123',
        email: 'driver@dsp.com',
        role: 'DRIVER',
      });
    });

    it('should return 401 when Authorization header is missing', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .expect(401);

      expect(res.body).toMatchObject({
        statusCode: 401,
        exito: false,
      });
    });
  });
});
