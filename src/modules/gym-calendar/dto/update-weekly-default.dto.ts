import { IsNotEmpty, IsObject, IsOptional, IsString, Allow } from 'class-validator';

export class UpdateWeeklyDefaultDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsNotEmpty({ message: 'Weekly schedule schedule is required' })
  @IsObject()
  @Allow()
  schedule: any;
}
