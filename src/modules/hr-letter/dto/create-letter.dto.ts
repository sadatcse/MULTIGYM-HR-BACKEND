import { IsEnum, IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';
import { HR_LETTER_TYPES, HrLetterType } from '../schemas/hr-letter-template.schema';

export class CreateLetterDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsNotEmpty()
  @IsEnum(HR_LETTER_TYPES)
  letterType: HrLetterType;

  @IsNotEmpty()
  @IsString()
  letterDate: string;

  @IsOptional()
  @IsString()
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsEnum(['draft', 'generated', 'issued'])
  status?: string;

  @IsOptional()
  @IsObject()
  inputData?: Record<string, any>;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsObject()
  customSignatories?: {
    issuedBy?: { name?: string; designation?: string; title?: string };
    approvedBy?: { name?: string; designation?: string; company?: string; onBehalfOf?: string };
    copyTo?: string[];
  };
}
