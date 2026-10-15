import { Body, Controller, ForbiddenException, Get, HttpStatus, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { HrAccessService } from '../hr-config/hr-access.service';
import { AssetAssignmentService } from './asset-assignment.service';
import { IssueAssetDto } from './dto/issue-asset.dto';
import { BulkIssueAssetDto } from './dto/bulk-issue-asset.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('asset-assignment')
@UseGuards(JwtAuthGuard)
export class AssetAssignmentController {
  constructor(
    private readonly assignmentService: AssetAssignmentService,
    private readonly access: HrAccessService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('assets', 'view')
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.assignmentService.findAll(query);
    return { statusCode: HttpStatus.OK, message: 'Asset assignments retrieved successfully', ...result };
  }

  @Get('employee-report')
  @UseGuards(PermissionsGuard)
  @RequirePermission('employee-asset-report', 'view')
  async employeeReport(@Query() query: Record<string, any>) {
    const result = await this.assignmentService.getEmployeeAssetReport(query);
    return { statusCode: HttpStatus.OK, message: 'Employee asset report retrieved successfully', ...result };
  }

  @Get('pending-returns')
  @UseGuards(PermissionsGuard)
  @RequirePermission('assets', 'view')
  async pendingReturns(@Query('employee') employee?: string) {
    const data = await this.assignmentService.findPendingReturns(employee);
    return { statusCode: HttpStatus.OK, message: 'Pending returns retrieved successfully', data };
  }

  @Get('dashboard-stats')
  @UseGuards(PermissionsGuard)
  @RequirePermission('assets', 'view')
  async dashboardStats() {
    const data = await this.assignmentService.getDashboardStats();
    return { statusCode: HttpStatus.OK, message: 'Asset dashboard stats retrieved successfully', data };
  }

  @Get('alerts')
  @UseGuards(PermissionsGuard)
  @RequirePermission('assets', 'view')
  async alerts() {
    const data = await this.assignmentService.getAlerts();
    return { statusCode: HttpStatus.OK, message: 'Asset alerts retrieved successfully', data };
  }

  @Get('employee/:employeeId')
  async byEmployee(@Param('employeeId') employeeId: string, @Req() req: any) {
    // Employees may only list their own assets (by _id or employee code).
    const actor = await this.access.getActor(req.user);
    if (actor.scope === 'self' && employeeId !== actor.id && employeeId !== actor.employeeCode) {
      throw new ForbiddenException('You can only view your own assets');
    }
    const data = await this.assignmentService.findByEmployee(employeeId);
    return { statusCode: HttpStatus.OK, message: "Employee's assets retrieved successfully", data };
  }

  @Get('asset/:assetId')
  @UseGuards(PermissionsGuard)
  @RequirePermission('assets', 'view')
  async byAsset(@Param('assetId') assetId: string) {
    const data = await this.assignmentService.findByAsset(assetId);
    return { statusCode: HttpStatus.OK, message: "Asset's assignment history retrieved successfully", data };
  }

  @Post('issue')
  @UseGuards(PermissionsGuard)
  @RequirePermission('assets', 'edit')
  async issue(@Body() dto: IssueAssetDto) {
    const data = await this.assignmentService.issue(dto);
    return { statusCode: HttpStatus.CREATED, message: 'Asset issued successfully', data };
  }

  @Post('bulk-issue')
  @UseGuards(PermissionsGuard)
  @RequirePermission('assets', 'edit')
  async bulkIssue(@Body() dto: BulkIssueAssetDto) {
    const data = await this.assignmentService.bulkIssue(dto);
    return { statusCode: HttpStatus.CREATED, message: 'Bulk asset assignments completed successfully', data };
  }

  @Put('return/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('assets', 'edit')
  async returnAsset(@Param('id') id: string, @Body() dto: ReturnAssetDto) {
    const data = await this.assignmentService.returnAsset(id, dto);
    return { statusCode: HttpStatus.OK, message: 'Asset returned successfully', data };
  }
}
