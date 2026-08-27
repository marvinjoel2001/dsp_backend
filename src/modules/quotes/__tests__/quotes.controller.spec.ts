import { Test, TestingModule } from '@nestjs/testing';
import { QuotesController } from '../quotes.controller';
import { QuotesService } from '../quotes.service';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('QuotesController', () => {
  let controller: QuotesController;
  let service: QuotesService;

  const mockQuotesService = {
    calculateAndCreateQuote: jest.fn(),
    getQuoteById: jest.fn(),
  };

  const mockDataSource = {
    getRepository: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuotesController],
      providers: [
        {
          provide: QuotesService,
          useValue: mockQuotesService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    controller = module.get<QuotesController>(QuotesController);
    service = module.get<QuotesService>(QuotesService);
    jest.clearAllMocks();
  });

  describe('createQuote', () => {
    it('should calculate and create a quote', async () => {
      const mockTenant = { id: 'tenant-1', name: 'Test Tenant' } as any;
      const dto = {
        pickupAddress: 'Av. A',
        pickupLat: -17.78,
        pickupLng: -63.18,
        dropoffAddress: 'Calle B',
        dropoffLat: -17.79,
        dropoffLng: -63.17,
      };
      const expectedQuote = {
        id: 'quote-1',
        tenantId: 'tenant-1',
        totalPrice: 15.5,
        driverPayout: 12.4,
        distanceKm: 3.2,
        durationMinutes: 13,
      };
      mockQuotesService.calculateAndCreateQuote.mockResolvedValue(expectedQuote);

      const result = await controller.createQuote(mockTenant, dto);
      expect(result).toEqual(expectedQuote);
      expect(service.calculateAndCreateQuote).toHaveBeenCalledWith('tenant-1', dto);
    });

    it('should propagate BadRequestException when distance > 50km', async () => {
      const mockTenant = { id: 'tenant-1' } as any;
      const dto = {
        pickupAddress: 'Av. A',
        pickupLat: -17.78,
        pickupLng: -63.18,
        dropoffAddress: 'Calle B',
        dropoffLat: -10.0,
        dropoffLng: -60.0,
      };
      mockQuotesService.calculateAndCreateQuote.mockRejectedValue(
        new BadRequestException('Supera el radio máximo permitido de entrega'),
      );

      await expect(controller.createQuote(mockTenant, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getQuote', () => {
    it('should return a quote by ID', async () => {
      const expectedQuote = { id: 'quote-1', totalPrice: 15.5 };
      mockQuotesService.getQuoteById.mockResolvedValue(expectedQuote);

      const result = await controller.getQuote('quote-1');
      expect(result).toEqual(expectedQuote);
      expect(service.getQuoteById).toHaveBeenCalledWith('quote-1');
    });

    it('should throw NotFoundException if quote does not exist', async () => {
      mockQuotesService.getQuoteById.mockRejectedValue(new NotFoundException('Cotización no encontrada'));
      await expect(controller.getQuote('unknown')).rejects.toThrow(NotFoundException);
    });
  });
});
