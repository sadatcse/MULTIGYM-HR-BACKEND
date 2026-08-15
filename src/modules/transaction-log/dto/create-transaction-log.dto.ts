import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateTransactionLogDto {
  @IsString()
  transactionType: string;

  @IsString()
  transactionCode: string;

  @IsString()
  userEmail: string;

  @IsString()
  userName: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsIn(['success', 'failed', 'pending'])
  status?: string;

  @IsString()
  ipAddress: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsString()
  Message?: string;

  @IsOptional()
  @IsString()
  stackTrace?: string;
}
