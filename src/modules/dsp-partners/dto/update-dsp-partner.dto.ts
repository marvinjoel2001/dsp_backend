import { PartialType } from '@nestjs/swagger';
import { CreateDspPartnerDto } from './create-dsp-partner.dto';

export class UpdateDspPartnerDto extends PartialType(CreateDspPartnerDto) {}
