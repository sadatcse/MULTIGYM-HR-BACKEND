import { IsNotEmpty, IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';

export class CreateProductCategoryDto {
  @IsNotEmpty({ message: 'Product category title is required' })
  @IsString()
  title: string;

  @IsNotEmpty({ message: 'Order is required' })
  @IsNumber()
  @Min(1)
  order: number;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
