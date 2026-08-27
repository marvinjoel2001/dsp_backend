import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from '../orders.controller';
import { OrdersService } from '../orders.service';
import { OrderStatus } from '../entities/order.entity';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: OrdersService;

  const mockOrdersService = {
    createOrder: jest.fn(),
    getAllOrders: jest.fn(),
    getOrderById: jest.fn(),
    updateOrderStatus: jest.fn(),
    getPublicTracking: jest.fn(),
  };

  const mockDataSource = {
    getRepository: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      const mockTenant = { id: 'tenant-1' } as any;
      const dto = { quoteId: 'quote-uuid-1' };
      const expectedOrder = {
        id: 'ord_12345678',
        tenantId: 'tenant-1',
        status: OrderStatus.CREATED,
        trackingToken: 'track_token_abc',
      };
      mockOrdersService.createOrder.mockResolvedValue(expectedOrder);

      const result = await controller.createOrder(mockTenant, dto);
      expect(result).toEqual(expectedOrder);
      expect(service.createOrder).toHaveBeenCalledWith('tenant-1', dto);
    });

    it('should propagate BadRequestException on missing coords or expired quote', async () => {
      const mockTenant = { id: 'tenant-1' } as any;
      mockOrdersService.createOrder.mockRejectedValue(new BadRequestException('Se requiere quoteId previo'));

      await expect(controller.createOrder(mockTenant, {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllOrders', () => {
    it('should list orders with optional status and tenant filter', async () => {
      const expectedOrders = [{ id: 'ord_1', status: OrderStatus.CREATED }];
      mockOrdersService.getAllOrders.mockResolvedValue(expectedOrders);

      const result = await controller.getAllOrders(OrderStatus.CREATED, 'tenant-1');
      expect(result).toEqual(expectedOrders);
      expect(service.getAllOrders).toHaveBeenCalledWith(OrderStatus.CREATED, 'tenant-1');
    });
  });

  describe('getOrderById', () => {
    it('should return order detail with logs and driver', async () => {
      const expected = { id: 'ord_1', status: OrderStatus.ASSIGNED, logs: [], driver: null };
      mockOrdersService.getOrderById.mockResolvedValue(expected);

      const result = await controller.getOrderById('ord_1');
      expect(result).toEqual(expected);
      expect(service.getOrderById).toHaveBeenCalledWith('ord_1');
    });

    it('should throw NotFoundException if order does not exist', async () => {
      mockOrdersService.getOrderById.mockRejectedValue(new NotFoundException('Orden no encontrada'));
      await expect(controller.getOrderById('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update status and return updated order', async () => {
      const dto = { status: OrderStatus.DELIVERED, proofPhotoUrl: 'https://img.com/p.jpg' };
      const expected = { id: 'ord_1', status: OrderStatus.DELIVERED, proofPhotoUrl: dto.proofPhotoUrl };
      mockOrdersService.updateOrderStatus.mockResolvedValue(expected);

      const result = await controller.updateStatus('ord_1', dto);
      expect(result).toEqual(expected);
      expect(service.updateOrderStatus).toHaveBeenCalledWith('ord_1', dto, 'DRIVER');
    });
  });

  describe('getPublicTracking', () => {
    it('should return public tracking data without auth', async () => {
      const expected = {
        orderId: 'ord_1',
        status: OrderStatus.IN_TRANSIT,
        driver: { fullName: 'Alex', currentLat: -17.78, currentLng: -63.18 },
      };
      mockOrdersService.getPublicTracking.mockResolvedValue(expected);

      const result = await controller.getPublicTracking('track-token-123');
      expect(result).toEqual(expected);
      expect(service.getPublicTracking).toHaveBeenCalledWith('track-token-123');
    });

    it('should throw NotFoundException on invalid token', async () => {
      mockOrdersService.getPublicTracking.mockRejectedValue(new NotFoundException('Token no encontrado'));
      await expect(controller.getPublicTracking('invalid')).rejects.toThrow(NotFoundException);
    });
  });
});
