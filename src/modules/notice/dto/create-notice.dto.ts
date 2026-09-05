import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NoticeCategory, NoticePriority, TargetType } from '../schemas/notice.schema';

export class NoticeAttachmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsOptional()
  fileType?: string;

  @IsOptional()
  size?: number;
}

export class CreateNoticeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(NoticeCategory)
  @IsOptional()
  category?: NoticeCategory;

  @IsEnum(NoticePriority)
  @IsOptional()
  priority?: NoticePriority;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => NoticeAttachmentDto)
  attachments?: NoticeAttachmentDto[];

  @IsEnum(TargetType)
  @IsOptional()
  targetType?: TargetType;

  @IsArray()
  @IsOptional()
  targetDepartments?: string[];

  @IsArray()
  @IsOptional()
  targetDesignations?: string[];

  @IsArray()
  @IsOptional()
  targetBranches?: string[];

  @IsArray()
  @IsOptional()
  targetEmployees?: string[];

  @IsBoolean()
  @IsOptional()
  requiresAcknowledgement?: boolean;

  @IsDateString()
  @IsOptional()
  acknowledgementDeadline?: string;

  @IsBoolean()
  @IsOptional()
  allowDownload?: boolean;

  @IsBoolean()
  @IsOptional()
  sendNotification?: boolean;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsBoolean()
  @IsOptional()
  autoPublish?: boolean;
}
