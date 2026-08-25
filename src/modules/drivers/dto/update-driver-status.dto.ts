import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleOnlineDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  @IsNotEmpty()
  isOnline: boolean;
}
