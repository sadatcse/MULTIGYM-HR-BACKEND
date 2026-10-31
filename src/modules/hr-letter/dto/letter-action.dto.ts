import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelLetterDto {
  @IsNotEmpty({ message: 'Please give a reason for cancelling this letter' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

// Actions the browser may record against a letter.
export class ClientAuditDto {
  @IsIn(['viewed', 'printed', 'downloaded'])
  action: 'viewed' | 'printed' | 'downloaded';
}
