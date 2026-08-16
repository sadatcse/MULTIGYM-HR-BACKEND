import { IsNotEmpty, IsString } from 'class-validator';

export class ChangePasswordEmployeeDto {
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}
