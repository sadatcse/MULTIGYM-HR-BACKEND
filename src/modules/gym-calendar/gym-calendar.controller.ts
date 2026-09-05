import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  ParseIntPipe,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { GymCalendarService } from './gym-calendar.service';
import { CreateDateOverrideDto } from './dto/create-date-override.dto';
import { CreateHolidayRangeDto } from './dto/create-holiday-range.dto';
import { UpdateWeeklyDefaultDto } from './dto/update-weekly-default.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('gym-calendar')
@UseGuards(JwtAuthGuard)
export class GymCalendarController {
  constructor(private readonly gymCalendarService: GymCalendarService) {}

  @Get('month')
  async getMonthCalendar(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
    @Query('branchId') branchId?: string,
  ) {
    const data = await this.gymCalendarService.getMonthCalendar(year, month, branchId || 'global');
    return {
      statusCode: HttpStatus.OK,
      message: 'Monthly Gym Calendar retrieved successfully',
      data,
    };
  }

  @Get('holidays')
  async getPublicHolidays(
    @Query('year') year?: string,
    @Query('branchId') branchId?: string,
  ) {
    const parsedYear = year ? parseInt(year, 10) : undefined;
    const data = await this.gymCalendarService.getPublicHolidays(parsedYear, branchId || 'global');
    return {
      statusCode: HttpStatus.OK,
      message: 'Public holidays schedule retrieved successfully from database',
      data,
    };
  }

  @Get('weekly-default')
  async getWeeklyDefault(@Query('branchId') branchId?: string) {
    const data = await this.gymCalendarService.getWeeklyDefault(branchId || 'global');
    return {
      statusCode: HttpStatus.OK,
      message: 'Weekly default schedule retrieved successfully',
      data,
    };
  }

  @Put('weekly-default')
  @UseGuards(PermissionsGuard)
  @RequirePermission('calendar', 'edit')
  async updateWeeklyDefault(@Body() dto: UpdateWeeklyDefaultDto) {
    const data = await this.gymCalendarService.updateWeeklyDefault(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Weekly default schedule updated successfully',
      data,
    };
  }

  @Post('date')
  @UseGuards(PermissionsGuard)
  @RequirePermission('calendar', 'edit')
  async saveDateOverride(@Body() dto: CreateDateOverrideDto) {
    const data = await this.gymCalendarService.saveDateOverride(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Date configuration saved successfully',
      data,
    };
  }

  @Post('holiday-range')
  @UseGuards(PermissionsGuard)
  @RequirePermission('calendar', 'edit')
  async saveHolidayRange(@Body() dto: CreateHolidayRangeDto) {
    const data = await this.gymCalendarService.saveHolidayRange(dto);
    return {
      statusCode: HttpStatus.OK,
      message: data.message,
      data: data.records,
    };
  }

  @Delete('date/:dateStr')
  @UseGuards(PermissionsGuard)
  @RequirePermission('calendar', 'edit')
  async resetDateOverride(
    @Param('dateStr') dateStr: string,
    @Query('branchId') branchId?: string,
  ) {
    const data = await this.gymCalendarService.resetDateOverride(dateStr, branchId || 'global');
    return {
      statusCode: HttpStatus.OK,
      message: data.message,
    };
  }
}
