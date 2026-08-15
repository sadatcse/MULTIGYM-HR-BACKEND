import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Department name is required' })
  name: string;

  @IsNumber()
  @Min(1, { message: 'Order must be at least 1' })
  order: number;

  @IsString()
  @IsEnum(['active', 'inactive'])
  @IsOptional()
  status?: string;
}
