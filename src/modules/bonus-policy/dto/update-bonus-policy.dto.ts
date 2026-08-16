import { PartialType } from '@nestjs/mapped-types';
import { CreateBonusPolicyDto } from './create-bonus-policy.dto';

export class UpdateBonusPolicyDto extends PartialType(CreateBonusPolicyDto) {}
