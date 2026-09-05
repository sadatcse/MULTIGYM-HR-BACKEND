import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddPaymentDto {
  @IsNumber()
  @Min(0.01, { message: 'Payment amount must be greater than zero' })
  amount: number;

  @IsDateString()
  @IsNotEmpty({ message: 'Payment date is required' })
  paymentDate: string;

  @IsOptional()
  @IsEnum(['cash', 'bank-transfer', 'cheque', 'mobile-banking', 'card', 'other'])
  method?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  recordedBy?: string;
}
