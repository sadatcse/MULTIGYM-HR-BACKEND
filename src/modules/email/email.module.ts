import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

// Provides EmailService to other modules (password reset).
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
