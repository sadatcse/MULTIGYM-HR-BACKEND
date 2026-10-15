import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { RosterAssignment, RosterAssignmentSchema, RosterChangeLog, RosterChangeLogSchema } from './schemas/roster.schema';
import { RosterService } from './roster.service';
import { HrAccessService } from '../hr-config/hr-access.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { addDays, todayStr } from '../../common/helpers/hr-date.helper';

@Controller('roster')
@UseGuards(JwtAuthGuard)
export class RosterController {
  constructor(
    private readonly service: RosterService,
    private readonly access: HrAccessService,
  ) {}

  @Get('duty-types')
  dutyTypes() {
    return { success: true, data: this.service.dutyTypes() };
  }

  // Own duties (mobile app). Defaults to the next 14 days.
  @Get('my')
  async my(@Query('from') from: string, @Query('to') to: string, @Req() req: any) {
    const actor = await this.access.getActor(req.user);
    const start = from || todayStr();
    const data = await this.service.list({ from: start, to: to || addDays(start, 13), employee: actor.id }, { ...actor, scope: 'self' });
    return { success: true, data };
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('duty-roster', 'view')
  async list(@Query() query: any, @Req() req: any) {
    const actor = await this.access.getActor(req.user);
    return { success: true, data: await this.service.list(query, actor) };
  }

  @Get('staff')
  @UseGuards(PermissionsGuard)
  @RequirePermission('duty-roster', 'view')
  async staff(@Query('branch') branch: string, @Req() req: any) {
    const actor = await this.access.getActor(req.user);
    return { success: true, data: await this.service.branchStaff(branch, actor) };
  }

  @Get('history')
  @UseGuards(PermissionsGuard)
  @RequirePermission('duty-roster', 'view')
  async history(@Query() query: any, @Req() req: any) {
    const actor = await this.access.getActor(req.user);
    return { success: true, ...(await this.service.history(query, actor)) };
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('duty-roster', 'add')
  async upsert(@Body() body: { items: any[]; reason?: string }, @Req() req: any) {
    const actor = await this.access.getActor(req.user);
    const data = await this.service.upsertMany(body.items, actor, body.reason);
    return { success: true, data, message: `${data.length} duty assignment(s) saved` };
  }

  @Post('copy-week')
  @UseGuards(PermissionsGuard)
  @RequirePermission('duty-roster', 'add')
  async copyWeek(@Body() body: any, @Req() req: any) {
    const actor = await this.access.getActor(req.user);
    const data = await this.service.copyWeek(body, actor);
    return { success: true, data, message: `${data.copied} duties copied` };
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('duty-roster', 'edit')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const actor = await this.access.getActor(req.user);
    return { success: true, data: await this.service.update(id, body, actor), message: 'Duty updated' };
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('duty-roster', 'delete')
  async remove(@Param('id') id: string, @Query('reason') reason: string, @Req() req: any) {
    const actor = await this.access.getActor(req.user);
    return this.service.remove(id, actor, reason);
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RosterAssignment.name, schema: RosterAssignmentSchema },
      { name: RosterChangeLog.name, schema: RosterChangeLogSchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
  ],
  controllers: [RosterController],
  providers: [RosterService],
  exports: [RosterService],
})
export class RosterModule {}
