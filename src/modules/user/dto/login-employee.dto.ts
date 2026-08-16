import { IsNotEmpty, IsString } from 'class-validator';

export class LoginEmployeeDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
