import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.ARRIVED_AT_PICKUP })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;

  @ApiProperty({ example: 'c8716b1e-6240-4b2a-8c01-7faef83151cf', required: false })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiProperty({ example: 'https://storage.dsp.com/proofs/photo_123.jpg', required: false })
  @IsOptional()
  @IsString()
  proofPhotoUrl?: string;

  @ApiProperty({ example: '<svg>...</svg>', required: false })
  @IsOptional()
  @IsString()
  signatureSvg?: string;

  @ApiProperty({ example: 'Delivered to recipient in person', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
