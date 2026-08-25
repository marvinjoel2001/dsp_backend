import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleOnlineDto {
  @ApiProperty({
    description: 'Estado de turno del conductor: true para Disponible (Online) y registrar en Redis GEO, false para Desconectado (Offline)',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  isOnline: boolean;
}
