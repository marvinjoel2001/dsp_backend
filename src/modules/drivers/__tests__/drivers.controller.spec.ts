import { Test, TestingModule } from '@nestjs/testing';
import { DriversController } from '../drivers.controller';
import { DriversService } from '../drivers.service';
import { DriverVerificationStatus } from '../entities/driver.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('DriversController', () => {
  let controller: DriversController;
  let service: DriversService;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DriversController],
      providers: [
        {
          provide: DriversService,
          useValue: mockDriversService,
        },
      ],
    }).compile();

    controller = module.get<DriversController>(DriversController);
    service = module.get<DriversService>(DriversService);
    jest.clearAllMocks();
  });

  describe('getAllDrivers', () => {
    it('should return all drivers', async () => {
      const expected = [{ id: 'driver-1', fullName: 'Carlos' }];
      mockDriversService.getAllDrivers.mockResolvedValue(expected);

      const result = await controller.getAllDrivers();
      expect(result).toEqual(expected);
    });
  });

  describe('getDriverById', () => {
    it('should return driver details', async () => {
      const expected = { id: 'driver-1', fullName: 'Carlos' };
      mockDriversService.getDriverById.mockResolvedValue(expected);

      const result = await controller.getDriverById('driver-1');
      expect(result).toEqual(expected);
      expect(service.getDriverById).toHaveBeenCalledWith('driver-1');
    });

    it('should throw NotFoundException if driver not found', async () => {
      mockDriversService.getDriverById.mockRejectedValue(new NotFoundException('No encontrado'));
      await expect(controller.getDriverById('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update and return driver profile', async () => {
      const updateData = { phone: '+59177777777', vehiclePlate: '9999-XYZ' };
      const expected = { id: 'driver-1', ...updateData };
      mockDriversService.updateProfile.mockResolvedValue(expected);

      const result = await controller.updateProfile('driver-1', updateData);
      expect(result).toEqual(expected);
      expect(service.updateProfile).toHaveBeenCalledWith('driver-1', updateData);
    });
  });

  describe('uploadDocuments', () => {
    it('should upload documents and set verification status', async () => {
      const docs = { licenseUrl: 'https://docs.com/license.pdf' };
      const expected = { id: 'driver-1', ...docs, verificationStatus: DriverVerificationStatus.PENDING };
      mockDriversService.uploadDocuments.mockResolvedValue(expected);

      const result = await controller.uploadDocuments('driver-1', docs);
      expect(result).toEqual(expected);
      expect(service.uploadDocuments).toHaveBeenCalledWith('driver-1', docs);
    });
  });

  describe('verifyDriver', () => {
    it('should update verification status', async () => {
      const expected = { id: 'driver-1', verificationStatus: DriverVerificationStatus.VERIFIED };
      mockDriversService.updateVerificationStatus.mockResolvedValue(expected);

      const result = await controller.verifyDriver('driver-1', { status: DriverVerificationStatus.VERIFIED });
      expect(result).toEqual(expected);
      expect(service.updateVerificationStatus).toHaveBeenCalledWith('driver-1', DriverVerificationStatus.VERIFIED);
    });
  });

  describe('toggleOnline', () => {
    it('should toggle online state to true', async () => {
      const expected = { id: 'driver-1', isOnline: true };
      mockDriversService.toggleOnlineStatus.mockResolvedValue(expected);

      const result = await controller.toggleOnline('driver-1', { isOnline: true });
      expect(result).toEqual(expected);
      expect(service.toggleOnlineStatus).toHaveBeenCalledWith('driver-1', true);
    });

    it('should propagate BadRequestException if driver was rejected', async () => {
      mockDriversService.toggleOnlineStatus.mockRejectedValue(
        new BadRequestException('Cuenta rechazada'),
      );
      await expect(controller.toggleOnline('driver-1', { isOnline: true })).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDriverFeed', () => {
    it('should return available orders feed for driver', async () => {
      const expectedFeed = [{ id: 'ord_1' }, { id: 'ord_2' }];
      mockDriversService.getAvailableFeedForDriver.mockResolvedValue(expectedFeed);

      const result = await controller.getDriverFeed('driver-1');
      expect(result).toEqual(expectedFeed);
    });
  });

  describe('getActiveOrder', () => {
    it('should return active order or null', async () => {
      const expectedOrder = { id: 'ord_active', status: 'IN_TRANSIT' };
      mockDriversService.getActiveOrderForDriver.mockResolvedValue(expectedOrder);

      const result = await controller.getActiveOrder('driver-1');
      expect(result).toEqual(expectedOrder);
    });
  });

  describe('getDriverWallet', () => {
    it('should return balance and transactions', async () => {
      const expectedWallet = { balance: 150.0, currency: 'USD', transactions: [] };
      mockDriversService.getDriverWallet.mockResolvedValue(expectedWallet);

      const result = await controller.getDriverWallet('driver-1');
      expect(result).toEqual(expectedWallet);
    });
  });
});
