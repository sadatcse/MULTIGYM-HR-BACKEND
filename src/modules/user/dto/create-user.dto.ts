import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Please provide an email address' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Please provide a password' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Please provide a name' })
  name: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsIn(['admin', 'user', 'manager'])
  role?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
