import { PartialType } from '@nestjs/mapped-types';
import { CreateAdvancePolicyDto } from './create-advance-policy.dto';

export class UpdateAdvancePolicyDto extends PartialType(CreateAdvancePolicyDto) {}
