import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { LETTER_FIELD_TYPES } from '../letter-format.helper';

export class TemplateInfoFieldDto {
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/, { message: 'Field key must start with a letter and use only letters, numbers or _' })
  key: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  labelBangla: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  labelEnglish?: string;

  @IsIn(['employee', 'custom', 'derived'])
  source: 'employee' | 'custom' | 'derived';

  @IsOptional()
  @IsString()
  @MaxLength(60)
  employeeField?: string;

  @IsBoolean()
  required: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  defaultValue?: string;

  @IsOptional()
  @IsIn(LETTER_FIELD_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  placeholder?: string;
}

export class TemplateSectionDto {
  @IsString()
  @MaxLength(10)
  sectionNumber: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  titleBangla: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleEnglish?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  introText?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  clauses?: string[];
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  titleBangla?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  titleEnglish?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]{1,39}$/, { message: 'Memo prefix may use letters, numbers, / _ - (e.g. MGP/HR/APT)' })
  memoPrefix?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(400)
  subjectTemplate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => TemplateInfoFieldDto)
  infoFields?: TemplateInfoFieldDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => TemplateSectionDto)
  sections?: TemplateSectionDto[];

  @IsOptional()
  @IsObject()
  defaultSignatories?: {
    issuedBy?: { name?: string; designation?: string; title?: string };
    approvedBy?: { name?: string; designation?: string; company?: string; onBehalfOf?: string };
    copyTo?: string[];
  };

  @IsOptional()
  @IsBoolean()
  hasEmployeeAcknowledgment?: boolean;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
