import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

// Provides EmailService to other modules (password reset). EmailController
// (POST /email/test) is deliberately not registered here.
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
