import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReturnAssetDto {
  @IsDateString()
  @IsNotEmpty({ message: 'Return date is required' })
  returnDate: string;

  @IsOptional()
  @IsString()
  returnCondition?: string;

  @IsOptional()
  @IsString()
  returnedTo?: string;

  @IsOptional()
  @IsString()
  returnNotes?: string;

  @IsOptional()
  @IsEnum(['none', 'damaged', 'lost', 'repair'])
  damageOrLoss?: string;

  @IsOptional()
  returnQuantity?: number;
}
