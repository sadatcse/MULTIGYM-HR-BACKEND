import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';

// Not imported by AppModule — mirrors the original, where these files existed but
// were never wired into server.js/routes.js.
@Module({
  controllers: [EmailController],
  providers: [EmailService],
})
export class EmailModule {}
