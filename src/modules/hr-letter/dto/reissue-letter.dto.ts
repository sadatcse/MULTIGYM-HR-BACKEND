import { IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ReissueLetterDto {
  @IsNotEmpty({ message: 'Please give a reason for reissuing' })
  @IsString()
  @MaxLength(500)
  reissueReason: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'letterDate must be YYYY-MM-DD' })
  letterDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'effectiveDate must be YYYY-MM-DD' })
  effectiveDate?: string;

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
