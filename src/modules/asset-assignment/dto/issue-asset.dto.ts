import { IsDateString, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class IssueAssetDto {
  @IsMongoId({ message: 'A valid employee is required' })
  employee: string;

  @IsMongoId({ message: 'A valid asset is required' })
  asset: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsDateString()
  @IsNotEmpty({ message: 'Issue date is required' })
  issueDate: string;

  @IsOptional()
  @IsString()
  issueCondition?: string;

  @IsOptional()
  @IsString()
  issuedBy?: string;

  @IsOptional()
  @IsString()
  issueNotes?: string;
}
