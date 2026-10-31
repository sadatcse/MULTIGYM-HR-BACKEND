import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;
}

export class VerifyResetCodeDto {
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'The code is 6 digits' })
  code: string;
}

export class ResetPasswordDto extends VerifyResetCodeDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  newPassword: string;
}
