import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import {
  AssignMaintenanceDto,
  AddWorkUpdateDto,
  CompleteMaintenanceDto,
  RejectMaintenanceDto,
  CancelMaintenanceDto,
} from './dto/maintenance-actions.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('maintenance')
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  // Employee self-service: open to every authenticated employee.
  @Post()
  async create(@Body() dto: CreateMaintenanceRequestDto, @Req() req: any) {
    const data = await this.maintenanceService.createRequest(dto, req.user);
    return { success: true, data, message: 'Maintenance request submitted successfully' };
  }

  @Get('my-requests')
  async getMyRequests(@Query() query: any, @Req() req: any) {
    const data = await this.maintenanceService.findMyRequests(query, req.user);
    return { success: true, data };
  }

  @Get('dashboard')
  async getDashboardStats(@Req() req: any) {
    const data = await this.maintenanceService.getDashboardStats(req.user);
    return { success: true, data };
  }

  // Management: full directory + reports.
  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('maintenance', 'view')
  async findAll(@Query() query: any, @Req() req: any) {
    const data = await this.maintenanceService.findAll(query, req.user);
    return { success: true, data };
  }

  @Get('reports/:type')
  @UseGuards(PermissionsGuard)
  @RequirePermission('maintenance', 'view')
  async getReports(@Param('type') type: string, @Query() query: any) {
    const data = await this.maintenanceService.getReports(type, query);
    return { success: true, data };
  }

  // Detail view — ownership-checked inside the service (own request or management).
  @Get(':id')
  async findById(@Param('id') id: string, @Req() req: any) {
    const data = await this.maintenanceService.findById(id, req.user);
    return { success: true, data };
  }

  @Put(':id/review')
  @UseGuards(PermissionsGuard)
  @RequirePermission('maintenance', 'edit')
  async markUnderReview(@Param('id') id: string, @Req() req: any) {
    const data = await this.maintenanceService.markUnderReview(id, req.user);
    return { success: true, data };
  }

  @Put(':id/assign')
  @UseGuards(PermissionsGuard)
  @RequirePermission('maintenance', 'edit')
  async assign(@Param('id') id: string, @Body() dto: AssignMaintenanceDto, @Req() req: any) {
    const data = await this.maintenanceService.assignRequest(id, dto, req.user);
    return { success: true, data, message: 'Maintenance request assigned successfully' };
  }

  @Post(':id/work-update')
  @UseGuards(PermissionsGuard)
  @RequirePermission('maintenance', 'edit')
  async addWorkUpdate(@Param('id') id: string, @Body() dto: AddWorkUpdateDto, @Req() req: any) {
    const data = await this.maintenanceService.addWorkUpdate(id, dto, req.user);
    return { success: true, data, message: 'Work update posted successfully' };
  }

  @Put(':id/complete')
  @UseGuards(PermissionsGuard)
  @RequirePermission('maintenance', 'edit')
  async complete(@Param('id') id: string, @Body() dto: CompleteMaintenanceDto, @Req() req: any) {
    const data = await this.maintenanceService.completeRequest(id, dto, req.user);
    return { success: true, data, message: 'Maintenance request completed successfully' };
  }

  @Put(':id/reject')
  @UseGuards(PermissionsGuard)
  @RequirePermission('maintenance', 'edit')
  async reject(@Param('id') id: string, @Body() dto: RejectMaintenanceDto, @Req() req: any) {
    const data = await this.maintenanceService.rejectRequest(id, dto, req.user);
    return { success: true, data, message: 'Maintenance request rejected' };
  }

  @Put(':id/cancel')
  @UseGuards(PermissionsGuard)
  @RequirePermission('maintenance', 'edit')
  async cancel(@Param('id') id: string, @Body() dto: CancelMaintenanceDto, @Req() req: any) {
    const data = await this.maintenanceService.cancelRequest(id, dto, req.user);
    return { success: true, data, message: 'Maintenance request cancelled' };
  }
}
