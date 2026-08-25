import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWebhookDto {
  @ApiProperty({ example: 'https://api.merchant.com/webhooks/dsp' })
  @IsUrl()
  @IsNotEmpty()
  webhookUrl: string;

  @ApiProperty({ example: 'whsec_custom_secret_key', required: false })
  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
