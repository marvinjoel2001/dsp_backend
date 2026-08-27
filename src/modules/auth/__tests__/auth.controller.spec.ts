import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { VehicleType } from '../../drivers/entities/driver.entity';
import { UnauthorizedException, ConflictException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    registerDriver: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return user and accessToken on successful login', async () => {
      const loginDto = { email: 'admin', password: 'admin' };
      const expectedResponse = {
        user: { id: 'admin-master-id', email: 'admin@chiringuito.com', role: 'ADMIN' },
        accessToken: 'mocked_jwt_token',
      };
      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto);
      expect(result).toEqual(expectedResponse);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });

    it('should propagate UnauthorizedException on invalid credentials', async () => {
      const loginDto = { email: 'wrong@mail.com', password: 'wrong' };
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Credenciales incorrectas'));

      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('registerDriver', () => {
    it('should register a driver and return driver data and accessToken', async () => {
      const registerDto = {
        fullName: 'Juan Perez',
        phone: '+59170012345',
        email: 'juan@dsp.com',
        password: 'password123',
        vehicleType: VehicleType.MOTORCYCLE,
      };
      const expectedResponse = {
        driver: { id: 'driver-uuid', fullName: 'Juan Perez', email: 'juan@dsp.com' },
        accessToken: 'driver_jwt_token',
      };
      mockAuthService.registerDriver.mockResolvedValue(expectedResponse);

      const result = await controller.registerDriver(registerDto);
      expect(result).toEqual(expectedResponse);
      expect(authService.registerDriver).toHaveBeenCalledWith(registerDto);
    });

    it('should propagate ConflictException if email/phone already registered', async () => {
      const registerDto = {
        fullName: 'Juan Perez',
        phone: '+59170012345',
        email: 'juan@dsp.com',
        password: 'password123',
        vehicleType: VehicleType.MOTORCYCLE,
      };
      mockAuthService.registerDriver.mockRejectedValue(new ConflictException('Ya existe un conductor'));

      await expect(controller.registerDriver(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('getMe', () => {
    it('should return authenticated user payload', async () => {
      const userPayload = { id: 'user-1', email: 'admin@dsp.com', role: 'ADMIN' };
      const result = await controller.getMe(userPayload);
      expect(result).toEqual(userPayload);
    });
  });
});
