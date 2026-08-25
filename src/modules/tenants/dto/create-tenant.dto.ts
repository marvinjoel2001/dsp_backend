import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({
    description: 'Nombre comercial de la tienda, restaurante o empresa B2B',
    example: 'SuperEats Bolivia S.R.L.',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Correo electrónico de contacto administrativo o de desarrollo',
    example: 'integraciones@supereats.bo',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'URL HTTPS del endpoint donde el comercio recibirá los Webhooks de eventos en tiempo real',
    example: 'https://api.supereats.bo/webhooks/dsp-events',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;
}
