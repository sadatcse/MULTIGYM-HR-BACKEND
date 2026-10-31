import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { HR_LETTER_TYPES, HrLetterType } from '../schemas/hr-letter-template.schema';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class LetterSignatoriesDto {
  issuedBy?: { name?: string; designation?: string; title?: string };
  approvedBy?: { name?: string; designation?: string; company?: string; onBehalfOf?: string };
  copyTo?: string[];
}

// Fields shared by create, preview and draft update.
export class LetterContentDto {
  @IsOptional()
  @Matches(ISO_DATE, { message: 'effectiveDate must be YYYY-MM-DD' })
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  branch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string;

  @IsOptional()
  @IsObject()
  inputData?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;

  @IsOptional()
  @IsObject()
  customSignatories?: LetterSignatoriesDto;
}

export class CreateLetterDto extends LetterContentDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsNotEmpty()
  @IsEnum(HR_LETTER_TYPES)
  letterType: HrLetterType;

  @IsNotEmpty()
  @Matches(ISO_DATE, { message: 'letterDate must be YYYY-MM-DD' })
  letterDate: string;

  @IsOptional()
  @IsEnum(['draft', 'generated'])
  status?: 'draft' | 'generated';
}

// Live preview from the create form: same body as create, nothing saved.
export class PreviewLetterDto extends LetterContentDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsNotEmpty()
  @IsEnum(HR_LETTER_TYPES)
  letterType: HrLetterType;

  @IsOptional()
  @Matches(ISO_DATE, { message: 'letterDate must be YYYY-MM-DD' })
  letterDate?: string;

  // When previewing an existing draft, keep its number in the preview.
  @IsOptional()
  @IsString()
  draftId?: string;
}

// Editing a saved draft (employee and type are fixed once saved).
export class UpdateDraftDto extends LetterContentDto {
  @IsOptional()
  @Matches(ISO_DATE, { message: 'letterDate must be YYYY-MM-DD' })
  letterDate?: string;
}
