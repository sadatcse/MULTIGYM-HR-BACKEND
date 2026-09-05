import { Controller, Get, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AccountabilityService } from './accountability.service';
import { AccountabilityEventService } from './accountability-event.service';
import { UnifiedReminderService } from './unified-reminder.service';
import { AccountabilityReportService } from './accountability-report.service';
import {
  AttentionQueueQueryDto,
  ActivityStreamQueryDto,
  GlobalSearchQueryDto,
  ReportQueryDto,
} from './dto/accountability-query.dto';

@Controller('accountability')
@UseGuards(JwtAuthGuard)
export class AccountabilityController {
  constructor(
    private readonly accountabilityService: AccountabilityService,
    private readonly eventService: AccountabilityEventService,
    private readonly reminderService: UnifiedReminderService,
    private readonly reportService: AccountabilityReportService,
  ) {}

  // 1. Management Command Center Overview Metrics
  @Get('dashboard')
  async getDashboardMetrics(@Req() req: any) {
    const data = await this.accountabilityService.getDashboardMetrics(req.user);
    return { success: true, data };
  }

  // 2. Unified "Requires Attention" Queue
  @Get('attention-queue')
  async getAttentionQueue(@Query() query: AttentionQueueQueryDto, @Req() req: any) {
    const data = await this.accountabilityService.getAttentionQueue(query, req.user);
    return { success: true, data };
  }

  // 3. Employee Combined Obligations ("My Responsibilities")
  @Get('my-obligations')
  async getMyObligations(@Req() req: any) {
    const data = await this.accountabilityService.getMyObligations(req.user);
    return { success: true, data };
  }

  // 4. Live Unified Activity Stream
  @Get('activity-stream')
  async getActivityStream(@Query() query: ActivityStreamQueryDto, @Req() req: any) {
    const data = await this.eventService.getActivityStream(query, req.user);
    return { success: true, data };
  }

  // 5. Global Polymorphic Search
  @Get('search')
  async searchAll(@Query() query: GlobalSearchQueryDto, @Req() req: any) {
    const data = await this.accountabilityService.searchAll(query, req.user);
    return { success: true, data };
  }

  // 6. Chronological Audit Timeline for specific communication
  @Get('timeline/:type/:id')
  async getTimeline(@Param('type') type: string, @Param('id') id: string) {
    const data = await this.eventService.getTimeline(type, id);
    return { success: true, data };
  }

  // 7. Multi-Entity Compliance & Accountability Reports
  @Get('reports/:type')
  async getReports(@Param('type') type: string, @Query() query: ReportQueryDto) {
    const data = await this.reportService.generateReport(type, query);
    return { success: true, data };
  }

  // 8. Manual trigger for reminder & overdue evaluation
  @Post('reminders/process')
  async processReminders() {
    const result = await this.reminderService.evaluateAllCommunications();
    return {
      success: true,
      message: 'Unified reminder and escalation evaluation completed successfully',
      result,
    };
  }
}
