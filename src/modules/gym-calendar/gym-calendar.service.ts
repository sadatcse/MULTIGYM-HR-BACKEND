import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GymCalendarDate, GymCalendarDateDocument } from './schemas/gym-calendar.schema';
import { GymWeeklyDefault, GymWeeklyDefaultDocument } from './schemas/gym-weekly-default.schema';
import { CreateDateOverrideDto } from './dto/create-date-override.dto';
import { CreateHolidayRangeDto } from './dto/create-holiday-range.dto';
import { UpdateWeeklyDefaultDto } from './dto/update-weekly-default.dto';

const DEFAULT_WEEKLY_SCHEDULE = {
  saturday: { gymStatus: 'open', dayType: 'working_day', openingTime: '07:00', closingTime: '23:00' },
  sunday: { gymStatus: 'open', dayType: 'working_day', openingTime: '07:00', closingTime: '23:00' },
  monday: { gymStatus: 'open', dayType: 'working_day', openingTime: '07:00', closingTime: '23:00' },
  tuesday: { gymStatus: 'open', dayType: 'working_day', openingTime: '07:00', closingTime: '23:00' },
  wednesday: { gymStatus: 'open', dayType: 'working_day', openingTime: '07:00', closingTime: '23:00' },
  thursday: { gymStatus: 'open', dayType: 'working_day', openingTime: '07:00', closingTime: '23:00' },
  friday: { gymStatus: 'closed', dayType: 'weekly_off', openingTime: '', closingTime: '' },
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

@Injectable()
export class GymCalendarService {
  constructor(
    @InjectModel(GymCalendarDate.name)
    private readonly calendarDateModel: Model<GymCalendarDateDocument>,

    @InjectModel(GymWeeklyDefault.name)
    private readonly weeklyDefaultModel: Model<GymWeeklyDefaultDocument>,
  ) {}

  private formatDateStr(y: number, m: number, d: number): string {
    const mm = m < 10 ? `0${m}` : `${m}`;
    const dd = d < 10 ? `0${d}` : `${d}`;
    return `${y}-${mm}-${dd}`;
  }

  async getPublicHolidays(year?: number, branchId: string = 'global') {
    const query: any = {
      dayType: { $in: ['public_holiday', 'special_holiday', 'company_holiday', 'emergency_closure'] },
    };
    if (year) {
      query.year = Number(year);
    }
    if (branchId && branchId !== 'all') {
      query.branchId = { $in: [branchId, 'global'] };
    }

    const records = await this.calendarDateModel
      .find(query)
      .sort({ dateStr: 1 })
      .exec();

    return records;
  }

  async getWeeklyDefault(branchId: string = 'global') {
    let doc = await this.weeklyDefaultModel.findOne({ branchId }).exec();
    if (!doc && branchId !== 'global') {
      doc = await this.weeklyDefaultModel.findOne({ branchId: 'global' }).exec();
    }
    if (!doc) {
      doc = await this.weeklyDefaultModel.create({ branchId: 'global', schedule: DEFAULT_WEEKLY_SCHEDULE });
    }
    return doc.schedule || DEFAULT_WEEKLY_SCHEDULE;
  }

  async updateWeeklyDefault(updateDto: UpdateWeeklyDefaultDto) {
    const bId = updateDto.branchId || 'global';
    let doc = await this.weeklyDefaultModel.findOne({ branchId: bId }).exec();
    if (!doc) {
      doc = new this.weeklyDefaultModel({ branchId: bId, schedule: updateDto.schedule });
    } else {
      doc.schedule = updateDto.schedule;
      doc.markModified('schedule');
    }
    await doc.save();
    return doc.schedule;
  }

  async getMonthCalendar(year: number, month: number, branchId: string = 'global') {
    if (!year || year < 2026 || year > 2032) {
      throw new BadRequestException('Year must be between 2026 and 2032.');
    }
    if (!month || month < 1 || month > 12) {
      throw new BadRequestException('Month must be between 1 and 12.');
    }

    const weeklySchedule = await this.getWeeklyDefault(branchId);

    const queryBranchIds = branchId === 'all' || branchId === 'global' ? ['global'] : [branchId, 'global'];
    const customOverrides = await this.calendarDateModel
      .find({ year, month, branchId: { $in: queryBranchIds } })
      .exec();

    const overrideMap = new Map<string, GymCalendarDateDocument>();
    customOverrides.forEach((item) => {
      const existing = overrideMap.get(item.dateStr);
      if (!existing || item.branchId === branchId) {
        overrideMap.set(item.dateStr, item);
      }
    });

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const days: any[] = [];
    let openDays = 0;
    let closedDays = 0;
    let publicHolidays = 0;
    let specialHolidays = 0;
    let companyHolidays = 0;
    let emergencyClosures = 0;
    let weeklyOffs = 0;
    let workingDays = 0;
    let paidHolidays = 0;
    let salaryApplicableDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(Date.UTC(year, month - 1, d));
      const dayOfWeekIdx = dateObj.getUTCDay();
      const dayName = DAY_NAMES[dayOfWeekIdx];
      const dayKey = dayName.toLowerCase();
      const dateStr = this.formatDateStr(year, month, d);

      const custom = overrideMap.get(dateStr);

      let dayData: any;

      if (custom) {
        dayData = {
          dateStr,
          year,
          month,
          day: d,
          dayName,
          dayOfWeekIdx,
          branchId: custom.branchId,
          gymStatus: custom.gymStatus,
          openingTime: custom.openingTime || '',
          closingTime: custom.closingTime || '',
          dayType: custom.dayType,
          title: custom.title || '',
          description: custom.description || '',
          isPaidHoliday: custom.isPaidHoliday ?? true,
          isSalaryApplicable: custom.isSalaryApplicable ?? true,
          isCustomOverride: true,
        };
      } else {
        const def = weeklySchedule[dayKey] || DEFAULT_WEEKLY_SCHEDULE[dayKey] || {
          gymStatus: 'open',
          dayType: 'working_day',
          openingTime: '07:00',
          closingTime: '23:00',
        };

        const isClosed = def.gymStatus === 'closed';
        const isOff = def.dayType === 'weekly_off' || isClosed;

        dayData = {
          dateStr,
          year,
          month,
          day: d,
          dayName,
          dayOfWeekIdx,
          branchId: 'global',
          gymStatus: def.gymStatus || (isOff ? 'closed' : 'open'),
          openingTime: def.openingTime || '',
          closingTime: def.closingTime || '',
          dayType: def.dayType || (isOff ? 'weekly_off' : 'working_day'),
          title: isOff ? (def.title || 'Weekly Off') : '',
          description: '',
          isPaidHoliday: isOff ? false : true,
          isSalaryApplicable: isOff ? false : true,
          isCustomOverride: false,
        };
      }

      if (dayData.gymStatus === 'open') openDays++;
      else closedDays++;

      if (dayData.dayType === 'public_holiday') publicHolidays++;
      else if (dayData.dayType === 'special_holiday') specialHolidays++;
      else if (dayData.dayType === 'company_holiday') companyHolidays++;
      else if (dayData.dayType === 'emergency_closure') emergencyClosures++;
      else if (dayData.dayType === 'weekly_off') weeklyOffs++;
      else if (dayData.dayType === 'working_day') workingDays++;

      if (dayData.isPaidHoliday) paidHolidays++;
      if (dayData.isSalaryApplicable) salaryApplicableDays++;

      days.push(dayData);
    }

    return {
      year,
      month,
      branchId,
      days,
      stats: {
        totalDays: daysInMonth,
        openDays,
        closedDays,
        publicHolidays,
        specialHolidays,
        companyHolidays,
        emergencyClosures,
        weeklyOffs,
        workingDays,
        paidHolidays,
        salaryApplicableDays,
      },
      weeklyDefault: weeklySchedule,
    };
  }

  async saveDateOverride(dto: CreateDateOverrideDto) {
    const bId = dto.branchId || 'global';
    const { dateStr } = dto;
    await this.calendarDateModel.updateOne(
      { dateStr, branchId: bId },
      { $set: { ...dto, branchId: bId } },
      { upsert: true },
    );
    return this.calendarDateModel.findOne({ dateStr, branchId: bId }).exec();
  }

  async saveHolidayRange(dto: CreateHolidayRangeDto) {
    const bId = dto.branchId || 'global';
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end date string.');
    }
    if (start > end) {
      throw new BadRequestException('Start date cannot be after end date.');
    }

    const savedRecords: any[] = [];
    const current = new Date(start);

    while (current <= end) {
      const year = current.getUTCFullYear();
      const month = current.getUTCMonth() + 1;
      const day = current.getUTCDate();
      const dayOfWeekIdx = current.getUTCDay();
      const dayName = DAY_NAMES[dayOfWeekIdx];
      const dateStr = this.formatDateStr(year, month, day);

      const recordDto: CreateDateOverrideDto = {
        branchId: bId,
        dateStr,
        year,
        month,
        day,
        dayName,
        gymStatus: dto.gymStatus,
        openingTime: dto.openingTime || '',
        closingTime: dto.closingTime || '',
        dayType: dto.dayType,
        title: dto.title,
        description: dto.description || '',
        isPaidHoliday: dto.isPaidHoliday ?? true,
        isSalaryApplicable: dto.isSalaryApplicable ?? true,
      };

      const record = await this.saveDateOverride(recordDto);
      savedRecords.push(record);

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return { message: `Successfully configured ${savedRecords.length} day(s)`, records: savedRecords };
  }

  async resetDateOverride(dateStr: string, branchId: string = 'global') {
    const res = await this.calendarDateModel.deleteOne({ dateStr, branchId }).exec();
    if (res.deletedCount === 0) {
      throw new NotFoundException(`No custom override found for date ${dateStr}.`);
    }
    return { message: `Date ${dateStr} reset to default weekly schedule successfully.` };
  }
}
