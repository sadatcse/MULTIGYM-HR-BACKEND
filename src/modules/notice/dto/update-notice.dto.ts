import { PartialType } from '@nestjs/mapped-types';
import { CreateNoticeDto } from './create-notice.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNoticeDto extends PartialType(CreateNoticeDto) {
  @IsBoolean()
  @IsOptional()
  isMajorUpdate?: boolean;
}
