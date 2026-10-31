import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

// Outgoing mail over the SMTP account in .env (SMTP_HOST / SMTP_PORT /
// SMTP_SECURE / SMTP_USER / SMTP_PASS). Port 587 with SMTP_SECURE=false
// upgrades via STARTTLS; port 465 uses SMTP_SECURE=true.
// Env is read lazily so ConfigModule has loaded .env before the first send.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter() {
    if (this.transporter) return this.transporter;
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      throw new Error('SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)');
    }
    const port = Number(process.env.SMTP_PORT) || 587;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true' || port === 465,
      auth: { user, pass },
    });
    return this.transporter;
  }

  private get from() {
    const address = process.env.SMTP_FROM || process.env.SMTP_USER;
    const name = process.env.MAIL_FROM_NAME || 'Multigym HR';
    return `"${name}" <${address}>`;
  }

  async sendEmail(to: string, subject: string, text: string, html?: string): Promise<string> {
    try {
      const info = await this.getTransporter().sendMail({ from: this.from, to, subject, text, html });
      return `Email sent (${info.messageId})`;
    } catch (err) {
      this.logger.error(`Failed to send "${subject}" to ${to}: ${(err as Error).message}`);
      throw err;
    }
  }

  async sendPasswordResetCode(to: string, name: string, code: string, minutes: number) {
    const subject = 'Your password reset code';
    const text =
      `Hi ${name || 'there'},\n\n` +
      `Your password reset code is: ${code}\n\n` +
      `It expires in ${minutes} minutes. If you did not request a reset, ignore this email; your password will not change.\n`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#18181B">
        <h2 style="margin:0 0 8px">Password reset</h2>
        <p>Hi ${escapeHtml(name || 'there')},</p>
        <p>Use this code to reset your password:</p>
        <p style="font-size:32px;font-weight:900;letter-spacing:8px;background:#F4F4F5;border-radius:12px;padding:16px;text-align:center;margin:16px 0">${code}</p>
        <p style="color:#71717A;font-size:13px">It expires in ${minutes} minutes. If you did not request a reset, ignore this email; your password will not change.</p>
      </div>`;
    return this.sendEmail(to, subject, text, html);
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
