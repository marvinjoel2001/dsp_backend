import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'SuperEats Bolivia' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'api@supereats.bo' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'https://api.supereats.bo/webhooks/dsp-events', required: false })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;
}
