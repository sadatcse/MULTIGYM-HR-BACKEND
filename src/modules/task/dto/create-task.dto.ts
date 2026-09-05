import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  InstructionSource,
  TaskPriority,
  CompletionCondition,
} from '../schemas/task.schema';

export class TaskAttachmentDto {
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
}

export class RecurrenceConfigDto {
  @IsString()
  @IsOptional()
  frequency?: string;

  @IsNumber()
  @IsOptional()
  intervalDays?: number;

  @ValidateIf((o) => !!o.endDate && o.endDate !== '')
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class SubtaskItemDto {
  @IsString()
  @IsOptional()
  _id?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  assigneeIds?: string[];

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsBoolean()
  @IsOptional()
  approvalRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  completionProofRequired?: boolean;
}

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(InstructionSource)
  @IsNotEmpty()
  instructionSource: InstructionSource;

  @IsString()
  @IsOptional()
  instructionSourceCustom?: string;

  @IsString()
  @IsOptional()
  issuedById?: string;

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
  @IsNotEmpty()
  assigneeIds: string[];

  @IsDateString()
  @IsOptional()
  instructionDate?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsNotEmpty()
  deadline: string;

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
  relatedNoticeId?: string;

  @IsString()
  @IsOptional()
  relatedEmployeeId?: string;

  @IsString()
  @IsOptional()
  relatedProject?: string;

  @IsString()
  @IsOptional()
  estimatedEffort?: string;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @IsOptional()
  @ValidateIf((o) => o.isRecurring === true && !!o.recurrence)
  @ValidateNested()
  @Type(() => RecurrenceConfigDto)
  recurrence?: RecurrenceConfigDto;

  @IsArray()
  @IsOptional()
  reminderSchedule?: number[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SubtaskItemDto)
  items?: SubtaskItemDto[];
}
