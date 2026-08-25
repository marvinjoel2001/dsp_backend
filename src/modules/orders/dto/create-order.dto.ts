import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: '32df9e8e-d9f7-4148-8cf4-fcf629cbbe70', required: false })
  @IsOptional()
  @IsUUID()
  quoteId?: string;

  @ApiProperty({ example: 'SHOP-9941', required: false })
  @IsOptional()
  @IsString()
  merchantReference?: string;

  @ApiProperty({ example: '062 Kuhn Plains Suite 793', required: false })
  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @ApiProperty({ example: -17.7833, required: false })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat?: number;

  @ApiProperty({ example: -63.1821, required: false })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng?: number;

  @ApiProperty({ example: '922 Wilfredo Tunnel', required: false })
  @IsOptional()
  @IsString()
  dropoffAddress?: string;

  @ApiProperty({ example: -17.7950, required: false })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  dropoffLat?: number;

  @ApiProperty({ example: -63.1700, required: false })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  dropoffLng?: number;

  @ApiProperty({ example: 'Call when you will be near entrance', required: false })
  @IsOptional()
  @IsString()
  packageNotes?: string;
}
