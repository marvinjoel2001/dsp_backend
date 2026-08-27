import { Test, TestingModule } from '@nestjs/testing';
import { DispatchController } from '../dispatch.controller';
import { DispatchService } from '../dispatch.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('DispatchController', () => {
  let controller: DispatchController;
  let service: DispatchService;

  const mockDispatchService = {
    matchAndDispatch: jest.fn(),
    acceptOffer: jest.fn(),
    manualAssign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DispatchController],
      providers: [
        {
          provide: DispatchService,
          useValue: mockDispatchService,
        },
      ],
    }).compile();

    controller = module.get<DispatchController>(DispatchController);
    service = module.get<DispatchService>(DispatchService);
    jest.clearAllMocks();
  });

  describe('triggerMatch', () => {
    it('should trigger geospatial matchmaking and return result', async () => {
      const expected = { matched: true, candidatesCount: 3 };
      mockDispatchService.matchAndDispatch.mockResolvedValue(expected);

      const result = await controller.triggerMatch('ord_123');
      expect(result).toEqual(expected);
      expect(service.matchAndDispatch).toHaveBeenCalledWith('ord_123');
    });

    it('should throw NotFoundException if order not found', async () => {
      mockDispatchService.matchAndDispatch.mockRejectedValue(new NotFoundException('Orden no encontrada'));
      await expect(controller.triggerMatch('ord_unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('acceptOffer', () => {
    it('should accept offer successfully and assign order', async () => {
      const dto = { orderId: 'ord_123', driverId: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' };
      const expected = {
        success: true,
        exito: true,
        mensaje: 'Pedido asignado y aceptado con éxito.',
        order: { id: 'ord_123', status: 'ASSIGNED' },
      };
      mockDispatchService.acceptOffer.mockResolvedValue(expected);

      const result = await controller.acceptOffer(dto);
      expect(result).toEqual(expected);
      expect(service.acceptOffer).toHaveBeenCalledWith(dto.orderId, dto.driverId);
    });

    it('should propagate ConflictException if order is already taken or completed', async () => {
      const dto = { orderId: 'ord_123', driverId: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' };
      mockDispatchService.acceptOffer.mockRejectedValue(new ConflictException('El pedido no puede ser aceptado'));

      await expect(controller.acceptOffer(dto)).rejects.toThrow(ConflictException);
    });

    it('should propagate BadRequestException if driver is inactive', async () => {
      const dto = { orderId: 'ord_123', driverId: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' };
      mockDispatchService.acceptOffer.mockRejectedValue(new BadRequestException('El conductor no es válido o está inactivo'));

      await expect(controller.acceptOffer(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('manualAssign', () => {
    it('should manually assign order to driver', async () => {
      const dto = { orderId: 'ord_123', driverId: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' };
      const expected = { id: 'ord_123', status: 'ASSIGNED', driverId: dto.driverId };
      mockDispatchService.manualAssign.mockResolvedValue(expected);

      const result = await controller.manualAssign(dto);
      expect(result).toEqual(expected);
      expect(service.manualAssign).toHaveBeenCalledWith(dto.orderId, dto.driverId);
    });

    it('should throw NotFoundException if order or driver not found', async () => {
      const dto = { orderId: 'ord_unknown', driverId: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' };
      mockDispatchService.manualAssign.mockRejectedValue(new NotFoundException('No encontrado'));

      await expect(controller.manualAssign(dto)).rejects.toThrow(NotFoundException);
    });
  });
});
