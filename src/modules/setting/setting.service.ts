import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting, SettingDocument } from './schemas/setting.schema';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingService {
  constructor(
    @InjectModel(Setting.name) private readonly settingModel: Model<SettingDocument>,
  ) {}

  // Get current site settings (or create default single document if empty)
  async getSettings(): Promise<SettingDocument> {
    let settings = await this.settingModel.findOne().exec();
    if (!settings) {
      settings = await this.settingModel.create({
        companyName: 'Multigym HR',
        companyTagline: 'Complete Enterprise HR & Payroll Management',
        email: 'info@multigymhr.com',
        phone: '+880 1700-000000',
        address: 'House 12, Road 5, Dhanmondi, Dhaka 1205, Bangladesh',
        website: 'https://multigymhr.com',
        logo: '',
        taxNumber: 'BIN-123456789',
        timeZone: 'Asia/Dhaka',
        dateFormat: 'YYYY-MM-DD',
        currencySymbol: '৳',
        language: 'English',
        enablePrintHeader: 'yes',
        enablePrintFooter: 'yes',
        printHeaderInch: 1.0,
        printFooterInch: 0.75,
        printHeaderText: 'MULTIGYM HR MANAGEMENT SYSTEM',
        printFooterText: 'This is a computer-generated document. No signature required.',
        probationMonths: 3,
        workingDaysPerWeek: 5,
        dailyWorkHours: 8,
        overtimeRate: 1.5,
      });
    }
    return settings;
  }

  // Update site settings
  async updateSettings(dto: UpdateSettingDto): Promise<SettingDocument> {
    let settings = await this.settingModel.findOne().exec();
    if (!settings) {
      settings = new this.settingModel(dto);
    } else {
      Object.assign(settings, dto);
    }
    return settings.save();
  }
}
