import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateQuoteDto {
  @ApiProperty({ example: '062 Kuhn Plains Suite 793' })
  @IsString()
  @IsNotEmpty()
  pickupAddress: string;

  @ApiProperty({ example: -17.7833 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat: number;

  @ApiProperty({ example: -63.1821 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng: number;

  @ApiProperty({ example: '922 Wilfredo Tunnel' })
  @IsString()
  @IsNotEmpty()
  dropoffAddress: string;

  @ApiProperty({ example: -17.7950 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  dropoffLat: number;

  @ApiProperty({ example: -63.1700 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  dropoffLng: number;

  @ApiProperty({ example: 1.0, required: false, description: 'Surge multiplier override' })
  @IsOptional()
  @IsNumber()
  surgeMultiplier?: number;
}
