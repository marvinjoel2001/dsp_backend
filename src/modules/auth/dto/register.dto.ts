import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleType } from '../../drivers/entities/driver.entity';

export class RegisterDriverDto {
  @ApiProperty({ example: 'Carlos Mendoza' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '+59170000000' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'carlos.driver@dsp.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: VehicleType, default: VehicleType.MOTORCYCLE })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiProperty({ example: '1234-XYZ', required: false })
  @IsOptional()
  @IsString()
  vehiclePlate?: string;
}
