import { PartialType } from '@nestjs/mapped-types';
import { CreateProxyDutyDto } from './create-proxy-duty.dto';

export class UpdateProxyDutyDto extends PartialType(CreateProxyDutyDto) {}
