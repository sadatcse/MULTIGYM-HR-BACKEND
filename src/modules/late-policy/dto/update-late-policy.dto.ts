import { PartialType } from '@nestjs/mapped-types';
import { CreateLatePolicyDto } from './create-late-policy.dto';

export class UpdateLatePolicyDto extends PartialType(CreateLatePolicyDto) {}
