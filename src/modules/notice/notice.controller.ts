import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Ip,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { NoticeService } from './notice.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('notice')
@UseGuards(JwtAuthGuard)
export class NoticeController {
  constructor(private readonly noticeService: NoticeService) {}

  // Employee: Get My Targeted Notices
  @Get('my-notices')
  async getMyNotices(@Req() req: any) {
    const data = await this.noticeService.getMyNotices(req.user);
    return { success: true, data };
  }

  // Employee: Record Automatic Seen Event
  @Post(':id/seen')
  async recordSeen(
    @Param('id') id: string,
    @Req() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const data = await this.noticeService.recordSeen(id, req.user, ip, userAgent);
    return { success: true, data };
  }

  // Employee: Record Acknowledgement Event
  @Post(':id/acknowledge')
  async recordAcknowledgement(@Param('id') id: string, @Req() req: any) {
    const data = await this.noticeService.recordAcknowledgement(id, req.user);
    return { success: true, data };
  }

  // Admin: Get Global Dashboard KPI Stats & Stream
  @Get('admin/dashboard')
  async getAdminDashboardStats() {
    const data = await this.noticeService.getAdminDashboardStats();
    return { success: true, data };
  }

  // Admin: Get Notice List
  @Get('admin/list')
  async getAllNoticesAdmin(@Query() query: any) {
    const data = await this.noticeService.getAllNoticesAdmin(query);
    return { success: true, data };
  }

  // Admin: Create Notice
  @Post('admin/create')
  @UseGuards(PermissionsGuard)
  @RequirePermission('notices', 'add')
  async createNotice(@Body() dto: CreateNoticeDto, @Req() req: any) {
    const data = await this.noticeService.createNotice(dto, req.user);
    return { success: true, data, message: 'Notice created successfully' };
  }

  // Admin: Update Notice
  @Put('admin/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('notices', 'edit')
  async updateNotice(@Param('id') id: string, @Body() dto: UpdateNoticeDto, @Req() req: any) {
    const data = await this.noticeService.updateNotice(id, dto, req.user);
    return { success: true, data, message: 'Notice updated successfully' };
  }

  // Admin: Publish Notice
  @Post('admin/:id/publish')
  @UseGuards(PermissionsGuard)
  @RequirePermission('notices', 'edit')
  async publishNotice(@Param('id') id: string, @Req() req: any) {
    const data = await this.noticeService.publishNotice(id, req.user);
    return { success: true, data, message: 'Notice published and dispatched to recipients' };
  }

  // Admin: Notice Monitoring & Recipient Matrix
  @Get('admin/:id/monitor')
  async getNoticeMonitoring(
    @Param('id') id: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.noticeService.getNoticeMonitoring(id, search, status);
    return { success: true, data };
  }

  // Admin: Send Reminder Notifications
  @Post('admin/:id/reminder')
  @UseGuards(PermissionsGuard)
  @RequirePermission('notices', 'edit')
  async sendReminder(@Param('id') id: string, @Req() req: any) {
    const data = await this.noticeService.sendReminder(id, req.user);
    return { success: true, data };
  }

  // Admin: Delete Notice
  @Delete('admin/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('notices', 'delete')
  async deleteNotice(@Param('id') id: string, @Req() req: any) {
    const data = await this.noticeService.deleteNotice(id, req.user);
    return { success: true, data };
  }
}
