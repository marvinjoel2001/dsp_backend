import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptOrderDto {
  @ApiProperty({ example: 'ord_8f912a7b' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' })
  @IsUUID()
  @IsNotEmpty()
  driverId: string;
}

export class RejectOrderDto {
  @ApiProperty({ example: 'ord_8f912a7b' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' })
  @IsUUID()
  @IsNotEmpty()
  driverId: string;

  @ApiProperty({ example: 'Too far away / Low battery', required: false })
  reason?: string;
}

export class ManualAssignDto {
  @ApiProperty({ example: 'ord_8f912a7b' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' })
  @IsUUID()
  @IsNotEmpty()
  driverId: string;
}
