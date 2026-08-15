import { Body, Controller, InternalServerErrorException, Post } from '@nestjs/common';
import { EmailService } from './email.service';
import { SendEmailDto } from './dto/send-email.dto';

// Ported from controllers/emailController.js. Unused in the original app (the route
// was never mounted anywhere) and unused here — EmailModule is not imported by AppModule.
@Controller('email')
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
