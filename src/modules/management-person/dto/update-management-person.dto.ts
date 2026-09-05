import { PartialType } from '@nestjs/mapped-types';
import { CreateManagementPersonDto } from './create-management-person.dto';

export class UpdateManagementPersonDto extends PartialType(CreateManagementPersonDto) {}
