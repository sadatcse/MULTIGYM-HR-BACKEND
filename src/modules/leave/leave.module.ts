import { Body, Controller, Get, Module, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { LeaveType, LeaveTypeSchema } from '../leave-type/schemas/leave-type.schema';
import { LeaveApplication, LeaveApplicationSchema } from './schemas/leave-application.schema';
import { LeaveService } from './leave.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { HrAccessService } from '../hr-config/hr-access.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('leave')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(
    private readonly service: LeaveService,
    private readonly access: HrAccessService,
  ) {}

  private actor(req: any) {
    return this.access.getActor(req.user);
  }

  // ---- Self service (web "My Leave" + mobile app) ----------------------
  @Post('apply')
  async apply(@Body() body: any, @Req() req: any) {
    const data = await this.service.apply(body, await this.actor(req));
    return { success: true, data, message: `Leave application ${data.applicationNo} submitted` };
  }

  @Get('my')
  async my(@Query() query: any, @Req() req: any) {
    const actor = await this.actor(req);
    return { success: true, ...(await this.service.list({ ...query, employee: actor.id }, { ...actor, scope: 'self' })) };
  }

  @Get('my-balance')
  async myBalance(@Query('year') year: string, @Req() req: any) {
    const actor = await this.actor(req);
    return { success: true, data: await this.service.balances(actor.id, parseInt(year, 10) || undefined) };
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Body('reason') reason: string, @Req() req: any) {
    const data = await this.service.cancel(id, reason, await this.actor(req));
    return { success: true, data, message: 'Leave application cancelled' };
  }

  // ---- Approvals ---------------------------------------------------------
  @Get('pending-for-me')
  async pending(@Req() req: any) {
    return { success: true, ...(await this.service.pendingForMe(await this.actor(req))) };
  }

  @Post(':id/act')
  async act(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const data = await this.service.act(id, body, await this.actor(req));
    return { success: true, data, message: 'Decision recorded' };
  }

  // ---- HR views ----------------------------------------------------------
  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('leave-applications', 'view')
  async list(@Query() query: any, @Req() req: any) {
    return { success: true, ...(await this.service.list(query, await this.actor(req))) };
  }

  @Get('register')
  @UseGuards(PermissionsGuard)
  @RequirePermission('leave-register', 'view')
  async register(@Query() query: any, @Req() req: any) {
    return { success: true, ...(await this.service.register(query, await this.actor(req))) };
  }

  @Get('balance/:employeeId')
  async balance(@Param('employeeId') employeeId: string, @Query('year') year: string, @Req() req: any) {
    const actor = await this.actor(req);
    if (employeeId !== actor.id && actor.scope === 'self') return { success: true, data: [] };
    return { success: true, data: await this.service.balances(employeeId, parseInt(year, 10) || undefined) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return { success: true, data: await this.service.findOne(id, await this.actor(req)) };
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LeaveApplication.name, schema: LeaveApplicationSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: LeaveType.name, schema: LeaveTypeSchema },
    ]),
    AttendanceModule,
  ],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
