import { IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsMongoId()
  receiverId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
