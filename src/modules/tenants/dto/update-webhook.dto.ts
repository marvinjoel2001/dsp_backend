import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWebhookDto {
  @ApiProperty({
    description: 'URL HTTPS del servidor del comercio para recibir notificaciones HTTP POST de eventos',
    example: 'https://api.comercio.com/webhooks/dsp',
  })
  @IsUrl()
  @IsNotEmpty()
  webhookUrl: string;

  @ApiProperty({
    description: 'Clave secreta opcional para firmar los payloads con HMAC SHA-256 (si no se envía, se conserva la existente)',
    example: 'whsec_custom_secret_key_2026',
    required: false,
  })
  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
