import { IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';

export class ReissueLetterDto {
  @IsNotEmpty()
  @IsString()
  reissueReason: string;

  @IsOptional()
  @IsString()
  letterDate?: string;

  @IsOptional()
  @IsString()
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
