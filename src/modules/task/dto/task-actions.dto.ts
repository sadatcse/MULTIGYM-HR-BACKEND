import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskAttachmentDto, SubtaskItemDto } from './create-task.dto';
import { InstructionSource, TaskPriority, CompletionCondition } from '../schemas/task.schema';

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(InstructionSource)
  @IsOptional()
  instructionSource?: InstructionSource;

  @IsString()
  @IsOptional()
  instructionSourceCustom?: string;

  @IsString()
  @IsOptional()
  branch?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsArray()
  @IsOptional()
  assigneeIds?: string[];

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsBoolean()
  @IsOptional()
  approvalRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  completionProofRequired?: boolean;

  @IsEnum(CompletionCondition)
  @IsOptional()
  completionCondition?: CompletionCondition;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TaskAttachmentDto)
  attachments?: TaskAttachmentDto[];

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsString()
  @IsOptional()
  relatedProject?: string;

  @IsString()
  @IsOptional()
  estimatedEffort?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SubtaskItemDto)
  items?: SubtaskItemDto[];
}

export class UpdateProgressDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  progress: number;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TaskAttachmentDto)
  attachments?: TaskAttachmentDto[];
}

export class UploadProofDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsOptional()
  fileType?: string;

  @IsNumber()
  @IsOptional()
  size?: number;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsString()
  @IsOptional()
  subtaskId?: string;
}

export class BatchUploadProofDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UploadProofDto)
  proofs: UploadProofDto[];

  @IsString()
  @IsOptional()
  remark?: string;

  @IsString()
  @IsOptional()
  subtaskId?: string;
}

export class SubmitTaskDto {
  @IsString()
  @IsOptional()
  remark?: string;

  @IsString()
  @IsOptional()
  subtaskId?: string;
}

export class ApproveTaskDto {
  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  assigneeEmployeeId?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  rating?: number;

  @IsString()
  @IsOptional()
  subtaskId?: string;
}

export class RejectTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  reason: string;

  @IsString()
  @IsOptional()
  assigneeEmployeeId?: string;

  @IsString()
  @IsOptional()
  subtaskId?: string;
}

export class ExtendDeadlineDto {
  @IsDateString()
  @IsNotEmpty({ message: 'New deadline is required' })
  newDeadline: string;

  @IsString()
  @IsNotEmpty({ message: 'Reason for deadline change is required' })
  reason: string;
}

export class CancelTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Cancellation reason is required' })
  reason: string;
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsString()
  @IsOptional()
  status?: string;
}

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsString()
  @IsOptional()
  status?: string;
}
