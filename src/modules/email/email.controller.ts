import { Body, Controller, InternalServerErrorException, Post, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { SendEmailDto } from './dto/send-email.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Ported from controllers/emailController.js. Unused in the original app (the route
// was never mounted anywhere) and unused here — EmailModule is not imported by AppModule.
// Guarded anyway (defense in depth) in case it's ever wired into AppModule later.
@Controller('email')
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('test')
  async sendTestEmail(@Body() dto: SendEmailDto) {
    try {
      const result = await this.emailService.sendEmail(dto.to, dto.subject, dto.body);
      return { message: result };
    } catch (error: any) {
      throw new InternalServerErrorException({ error: error?.message });
    }
  }
}
