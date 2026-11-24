import { IsNotEmpty, IsString } from 'class-validator';

export class LoginEmployeeDto {
  // Email address or mobile number.
  @IsString()
  @IsNotEmpty({ message: 'Enter your email or mobile number' })
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
