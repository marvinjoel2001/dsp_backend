import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Nuevo estado de la orden en la máquina de estados',
    enum: OrderStatus,
    example: OrderStatus.ARRIVED_AT_PICKUP,
  })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;

  @ApiProperty({
    description: 'UUID del conductor que ejecuta la transición',
    example: 'c8716b1e-6240-4b2a-8c01-7faef83151cf',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiProperty({
    description: 'URL de la fotografía como comprobante de entrega (POD)',
    example: 'https://storage.midsp.com/proofs/entrega_9941.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  proofPhotoUrl?: string;

  @ApiProperty({
    description: 'Firma digital en formato SVG o Base64 del receptor',
    example: '<svg xmlns="http://www.w3.org/2000/svg">...</svg>',
    required: false,
  })
  @IsOptional()
  @IsString()
  signatureSvg?: string;

  @ApiProperty({
    description: 'Comentarios o notas de la entrega',
    example: 'Entregado a cliente en persona con conformidad',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
