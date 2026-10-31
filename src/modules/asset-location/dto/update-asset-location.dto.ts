import { PartialType } from '@nestjs/mapped-types';
import { CreateAssetLocationDto } from './create-asset-location.dto';

export class UpdateAssetLocationDto extends PartialType(CreateAssetLocationDto) {}
