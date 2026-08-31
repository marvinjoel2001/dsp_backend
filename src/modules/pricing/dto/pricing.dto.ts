import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DistanceBracketDto {
  @IsNumber()
  @Min(0)
  fromKm: number;

  @IsNumber()
  @Min(0.1)
  toKm: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  driverPayout: number;
}

export class CreatePricingConfigDto {
  @IsOptional()
  @IsString()
  dspPartnerId?: string;

  @IsString()
  vehicleType: string; // 'MOTORCYCLE' | 'BICYCLE' | 'CAR' | 'ALL'

  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  baseFare: number;

  @IsNumber()
  @Min(0)
  baseDistanceKm: number;

  @IsNumber()
  @Min(0)
  perKmBeyondBase: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  perMinuteRate?: number;

  @IsNumber()
  @Min(0)
  driverPayoutPercentage: number;

  @IsNumber()
  @Min(0)
  minPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DistanceBracketDto)
  brackets: DistanceBracketDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SimulateQuoteDto {
  @IsNumber()
  distanceKm: number;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  dspPartnerId?: string;

  @IsOptional()
  @IsNumber()
  surgeMultiplier?: number;
}
