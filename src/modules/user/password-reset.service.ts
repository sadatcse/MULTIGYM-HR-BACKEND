import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { Employee, EmployeeDocument } from './schemas/employee.schema';
import { EmailService } from '../email/email.service';

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const RESET_FIELDS = '+resetCodeHash +resetCodeExpires +resetCodeAttempts +resetCodeSentAt';
const INVALID = 'Invalid or expired code. Request a new one.';

// Forgot password: email a 6-digit code, verify it, then set a new password.
// Shared by the web dashboard and the mobile app (both sign in as Employee).
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    private readonly email: EmailService,
  ) {}

  private hash(email: string, code: string) {
    return createHmac('sha256', process.env.JWT_SECRET || 'reset-code').update(`${email}:${code}`).digest('hex');
  }

  private normalize(email: string) {
    return String(email || '').trim().toLowerCase();
  }

  // Always answers the same way whether or not the account exists, so the
  // endpoint can't be used to discover which emails are registered.
  async requestCode(rawEmail: string) {
    const email = this.normalize(rawEmail);
    const generic = {
      message: `If an account exists for ${email}, a 6-digit code has been sent. It expires in ${CODE_TTL_MINUTES} minutes.`,
      expiresInMinutes: CODE_TTL_MINUTES,
    };

    const employee = await this.employeeModel.findOne({ email }).select(RESET_FIELDS);
    if (!employee || employee.status === 'inactive') return generic;

    if (employee.resetCodeSentAt && Date.now() - employee.resetCodeSentAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new BadRequestException('A code was just sent. Please wait a minute before requesting another.');
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    employee.resetCodeHash = this.hash(email, code);
    employee.resetCodeExpires = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
    employee.resetCodeAttempts = 0;
    employee.resetCodeSentAt = new Date();
    await employee.save();

    try {
      await this.email.sendPasswordResetCode(email, employee.name, code, CODE_TTL_MINUTES);
    } catch {
      // Let the user retry straight away instead of waiting out the cooldown.
      await this.employeeModel.updateOne({ _id: employee._id }, { $unset: { resetCodeHash: 1, resetCodeExpires: 1, resetCodeSentAt: 1 } });
      throw new ServiceUnavailableException('Could not send the email right now. Please try again shortly.');
    }
    return generic;
  }

  private async checkCode(rawEmail: string, code: string) {
    const email = this.normalize(rawEmail);
    const employee = await this.employeeModel.findOne({ email }).select(RESET_FIELDS);
    if (!employee || employee.status === 'inactive' || !employee.resetCodeHash || !employee.resetCodeExpires) {
      throw new BadRequestException(INVALID);
    }
    if (employee.resetCodeExpires.getTime() < Date.now() || (employee.resetCodeAttempts || 0) >= MAX_ATTEMPTS) {
      throw new BadRequestException(INVALID);
    }

    const expected = Buffer.from(employee.resetCodeHash, 'hex');
    const given = Buffer.from(this.hash(email, code), 'hex');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      const attempts = (employee.resetCodeAttempts || 0) + 1;
      await this.employeeModel.updateOne({ _id: employee._id }, { $set: { resetCodeAttempts: attempts } });
      const left = MAX_ATTEMPTS - attempts;
      throw new BadRequestException(left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : INVALID);
    }
    return employee;
  }

  async verifyCode(email: string, code: string) {
    await this.checkCode(email, code);
    return { message: 'Code verified', valid: true };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const employee = await this.checkCode(email, code);
    employee.password = newPassword; // hashed by the schema's pre('save') hook
    employee.resetCodeHash = undefined;
    employee.resetCodeExpires = undefined;
    employee.resetCodeAttempts = 0;
    employee.resetCodeSentAt = undefined;
    await employee.save();
    this.logger.log(`Password reset via email code for ${employee.email}`);
    return { message: 'Password updated. You can now sign in with your new password.' };
  }
}
