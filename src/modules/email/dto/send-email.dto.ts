import { IsString } from 'class-validator';

export class SendEmailDto {
  @IsString()
  to: string;

  @IsString()
  subject: string;

  @IsString()
  body: string;
}
