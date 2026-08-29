import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVendorCategoryDto {
  @IsNotEmpty({ message: 'Vendor category title is required' })
  @IsString()
  title: string;

  @IsNotEmpty({ message: 'Order is required' })
  @IsNumber()
  @Min(1, { message: 'Order must be at least 1' })
  order: number;

  @IsOptional()
  @IsEnum(['active', 'inactive'], { message: 'Status must be active or inactive' })
  status?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
