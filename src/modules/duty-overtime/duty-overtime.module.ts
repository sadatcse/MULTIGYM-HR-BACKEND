import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OvertimeRecord, OvertimeRecordDocument, OvertimeRecordSchema } from '../overtime/schemas/overtime-record.schema';
import { ProxyDuty, ProxyDutyDocument, ProxyDutySchema } from '../proxy-duty/schemas/proxy-duty.schema';
import { Employee, EmployeeDocument, EmployeeSchema } from '../user/schemas/employee.schema';
import { AttendanceRecord, AttendanceRecordDocument, AttendanceRecordSchema } from '../attendance/schemas/attendance.schema';
import { PayrollRun, PayrollRunDocument, PayrollRunSchema } from '../payroll/schemas/payroll.schema';
import { Actor, HrAccessService } from '../hr-config/hr-access.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { isDateStr, isMonthStr, monthRange } from '../../common/helpers/hr-date.helper';

const minutesOf = (r: any) => Math.round((Number(r.overtimeHours) || 0) * 60 + (Number(r.overtimeMinutes) || 0));

// Month-by-month upkeep of overtime, proxy duty and duty swaps. Approved
// overtime records and proxy pay are picked up by that month's payroll.
@Injectable()
export class DutyOvertimeService {
  constructor(
    @InjectModel(OvertimeRecord.name) private readonly otModel: Model<OvertimeRecordDocument>,
    @InjectModel(ProxyDuty.name) private readonly dutyModel: Model<ProxyDutyDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(AttendanceRecord.name) private readonly recordModel: Model<AttendanceRecordDocument>,
    @InjectModel(PayrollRun.name) private readonly runModel: Model<PayrollRunDocument>,
    private readonly access: HrAccessService,
  ) {}

  private assertStaff(actor: Actor) {
    if (actor.scope === 'self') throw new ForbiddenException('Restricted to HR / branch management');
  }

  private async assertOpen(date: string, branch: string) {
    const month = date.slice(0, 7);
    const run = await this.runModel.findOne({ month, status: { $ne: 'draft' }, branch: { $in: ['all', branch || ''] } }).select('status').lean();
    if (run) throw new BadRequestException(`Payroll for ${month} is already ${run.status} — this month can no longer change`);
  }

  private async employee(id: string, actor: Actor) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Choose an employee');
    const emp: any = await this.employeeModel.findById(id).lean();
    if (!emp) throw new NotFoundException('Employee not found');
    this.access.assertCanAccess(actor, String(emp._id), emp.branches);
    return emp;
  }

  // Staff in scope for the filters (branch / department), for summaries.
  private async staff(actor: Actor, query: any) {
    const filter: any = { status: { $nin: ['inactive', 'resigned', 'terminated'] } };
    const branches = this.access.resolveBranchFilter(actor, query.branch);
    if (branches) filter.branches = { $in: branches };
    if (query.department && query.department !== 'all') filter.department = query.department;
    return this.employeeModel.find(filter).select('name employeeId jobPosition department branches photo').sort({ name: 1 }).lean();
  }

  // ---------------------------------------------------------------- overtime
  async overtime(query: any, actor: Actor) {
    this.assertStaff(actor);
    if (!isMonthStr(query.month)) throw new BadRequestException('month must be YYYY-MM');
    const { from, to } = monthRange(query.month);
    const emps = await this.staff(actor, query);
    const ids = emps.map((e) => e._id);
    const codes = emps.map((e) => e.employeeId).filter(Boolean);
    const [att, records] = await Promise.all([
      this.recordModel.aggregate([
        { $match: { date: { $gte: from, $lte: to }, employee: { $in: ids }, overtimeMinutes: { $gt: 0 } } },
        { $group: { _id: '$employee', minutes: { $sum: '$overtimeMinutes' }, days: { $sum: 1 } } },
      ]),
      this.otModel.find({ recordDate: { $gte: from, $lte: to }, $or: [{ employee: { $in: ids } }, { employee: null, employeeId: { $in: codes } }] }).sort({ recordDate: -1, createdAt: -1 }).lean(),
    ]);
    const attMap = new Map(att.map((a) => [String(a._id), a]));
    const byCode = new Map(emps.map((e) => [e.employeeId, String(e._id)]));
    const keyOf = (r: any) => (r.employee ? String(r.employee) : byCode.get(r.employeeId) || '');
    const rows = emps
      .map((e) => {
        const id = String(e._id);
        const mine = records.filter((r) => keyOf(r) === id);
        const a = attMap.get(id);
        return {
          employee: { _id: e._id, name: e.name, employeeId: e.employeeId, jobPosition: e.jobPosition, department: e.department, branch: e.branches?.[0] || '', photo: e.photo },
          attendanceMinutes: a?.minutes || 0,
          attendanceDays: a?.days || 0,
          approvedMinutes: mine.filter((r) => r.status === 'approved').reduce((s, r) => s + minutesOf(r), 0),
          pending: mine.filter((r) => r.status === 'pending').length,
        };
      })
      .filter((r) => r.attendanceMinutes || r.approvedMinutes || r.pending || query.all === 'true');
    const nameOf = new Map(emps.map((e) => [String(e._id), e]));
    return {
      month: query.month,
      rows,
      records: records.map((r) => ({ ...r, minutes: minutesOf(r), branch: r.branch || nameOf.get(keyOf(r))?.branches?.[0] || '', department: r.department || nameOf.get(keyOf(r))?.department || '' })),
      stats: {
        attendanceMinutes: rows.reduce((s, r) => s + r.attendanceMinutes, 0),
        approvedMinutes: rows.reduce((s, r) => s + r.approvedMinutes, 0),
        pending: records.filter((r) => r.status === 'pending').length,
        people: rows.length,
      },
    };
  }

  async addOvertime(dto: any, actor: Actor) {
    this.assertStaff(actor);
    const emp = await this.employee(dto.employeeId, actor);
    if (!isDateStr(dto.recordDate)) throw new BadRequestException('Date must be YYYY-MM-DD');
    const hours = Math.max(0, Number(dto.overtimeHours) || 0);
    const minutes = Math.max(0, Number(dto.overtimeMinutes) || 0);
    if (hours * 60 + minutes <= 0) throw new BadRequestException('Enter the overtime worked');
    const branch = emp.branches?.[0] || '';
    await this.assertOpen(dto.recordDate, branch);
    const approve = dto.status === 'approved' && actor.scope === 'all' && String(emp._id) !== actor.id;
    return this.otModel.create({
      employee: emp._id,
      employeeName: emp.name,
      employeeId: emp.employeeId || '',
      branch,
      department: emp.department || '',
      designation: emp.jobPosition || '',
      recordDate: dto.recordDate,
      overtimeHours: hours,
      overtimeMinutes: minutes,
      status: approve ? 'approved' : 'pending',
      remarks: String(dto.remarks || '').trim(),
      createdBy: { id: actor.id, name: actor.name },
      decidedBy: approve ? { id: actor.id, name: actor.name, at: new Date() } : null,
    });
  }

  async updateOvertime(id: string, dto: any, actor: Actor) {
    this.assertStaff(actor);
    const r = await this.otModel.findById(id);
    if (!r) throw new NotFoundException('Overtime record not found');
    if (r.employee) this.access.assertCanAccess(actor, String(r.employee), r.branch);
    await this.assertOpen(r.recordDate, r.branch);
    if (dto.status && ['approved', 'rejected', 'pending'].includes(dto.status) && dto.status !== r.status) {
      if (r.employee && String(r.employee) === actor.id && !actor.isSuperAdmin) throw new ForbiddenException('You cannot approve your own overtime');
      r.status = dto.status;
      r.decidedBy = dto.status === 'pending' ? null : { id: actor.id, name: actor.name, at: new Date() };
    }
    if (dto.overtimeHours !== undefined) r.overtimeHours = Math.max(0, Number(dto.overtimeHours) || 0);
    if (dto.overtimeMinutes !== undefined) r.overtimeMinutes = Math.max(0, Number(dto.overtimeMinutes) || 0);
    if (dto.remarks !== undefined) r.remarks = String(dto.remarks).trim();
    await r.save();
    return r;
  }

  async removeOvertime(id: string, actor: Actor) {
    this.assertStaff(actor);
    const r = await this.otModel.findById(id);
    if (!r) throw new NotFoundException('Overtime record not found');
    if (r.employee) this.access.assertCanAccess(actor, String(r.employee), r.branch);
    await this.assertOpen(r.recordDate, r.branch);
    await r.deleteOne();
    return { message: 'Overtime record deleted' };
  }

  // ---------------------------------------------------------------- proxy & swap duty
  async duties(query: any, actor: Actor) {
    this.assertStaff(actor);
    if (!isMonthStr(query.month)) throw new BadRequestException('month must be YYYY-MM');
    const { from, to } = monthRange(query.month);
    const emps = await this.staff(actor, { ...query, department: undefined });
    const byCode = new Map(emps.map((e) => [e.employeeId, e]));
    const filter: any = { dutyDate: { $gte: from, $lte: to } };
    if (query.type === 'swap') filter.type = 'swap';
    else if (query.type === 'proxy') filter.type = { $ne: 'swap' };
    const list = await this.dutyModel.find(filter).sort({ dutyDate: -1 }).lean();
    const scoped = this.access.resolveBranchFilter(actor, query.branch);
    const data = list
      .map((d) => {
        const o: any = byCode.get(d.originalEmployeeId) || null;
        return { ...d, type: d.type || 'proxy', branch: d.branch || o?.branches?.[0] || '', department: d.department || o?.department || '' };
      })
      .filter((d) => !scoped || scoped.includes(d.branch))
      .filter((d) => !query.department || query.department === 'all' || d.department === query.department);
    const proxies = data.filter((d) => d.type !== 'swap' && d.status !== 'inactive');
    return { month: query.month, data, stats: { proxies: proxies.length, swaps: data.filter((d) => d.type === 'swap').length, proxyPay: proxies.reduce((s, d) => s + (Number(d.proxyPayAmount) || 0), 0) } };
  }

  async saveDuty(id: string | null, dto: any, actor: Actor) {
    this.assertStaff(actor);
    const type = dto.type === 'swap' ? 'swap' : 'proxy';
    const original = await this.employee(dto.originalEmployee, actor);
    const cover = await this.employee(dto.proxyEmployee, actor);
    if (String(original._id) === String(cover._id)) throw new BadRequestException('Pick two different people');
    if (!isDateStr(dto.dutyDate)) throw new BadRequestException('Duty date must be YYYY-MM-DD');
    if (type === 'swap' && dto.swapDate && !isDateStr(dto.swapDate)) throw new BadRequestException('Return date must be YYYY-MM-DD');
    const branch = original.branches?.[0] || '';
    await this.assertOpen(dto.dutyDate, branch);
    const values = {
      type,
      originalEmployee: original._id,
      originalEmployeeName: original.name,
      originalEmployeeId: original.employeeId || '',
      proxyEmployee: cover._id,
      proxyEmployeeName: cover.name,
      proxyEmployeeId: cover.employeeId || '',
      dutyDate: dto.dutyDate,
      swapDate: type === 'swap' ? dto.swapDate || '' : '',
      proxyPayAmount: type === 'proxy' ? Math.max(0, Number(dto.proxyPayAmount) || 0) : 0,
      status: ['active', 'inactive', 'completed'].includes(dto.status) ? dto.status : 'active',
      remarks: String(dto.remarks || '').trim(),
      branch,
      department: original.department || '',
    };
    if (!id) return this.dutyModel.create({ ...values, createdBy: { id: actor.id, name: actor.name } });
    const doc = await this.dutyModel.findById(id);
    if (!doc) throw new NotFoundException('Duty record not found');
    await this.assertOpen(doc.dutyDate, doc.branch || branch);
    Object.assign(doc, values);
    await doc.save();
    return doc;
  }

  async removeDuty(id: string, actor: Actor) {
    this.assertStaff(actor);
    const doc = await this.dutyModel.findById(id);
    if (!doc) throw new NotFoundException('Duty record not found');
    await this.assertOpen(doc.dutyDate, doc.branch);
    await doc.deleteOne();
    return { message: 'Duty record deleted' };
  }
}

@Controller('duty-overtime')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DutyOvertimeController {
  constructor(
    private readonly service: DutyOvertimeService,
    private readonly access: HrAccessService,
  ) {}

  private actor(req: any) {
    return this.access.getActor(req.user);
  }

  @Get('overtime')
  @RequirePermission('duty-overtime', 'view')
  async overtime(@Query() q: any, @Req() req: any) {
    return { success: true, data: await this.service.overtime(q, await this.actor(req)) };
  }

  @Post('overtime')
  @RequirePermission('duty-overtime', 'add')
  async addOvertime(@Body() b: any, @Req() req: any) {
    return { success: true, data: await this.service.addOvertime(b, await this.actor(req)), message: 'Overtime recorded' };
  }

  @Patch('overtime/:id')
  @RequirePermission('duty-overtime', 'edit')
  async updateOvertime(@Param('id') id: string, @Body() b: any, @Req() req: any) {
    return { success: true, data: await this.service.updateOvertime(id, b, await this.actor(req)), message: 'Overtime updated' };
  }

  @Delete('overtime/:id')
  @RequirePermission('duty-overtime', 'delete')
  async removeOvertime(@Param('id') id: string, @Req() req: any) {
    return this.service.removeOvertime(id, await this.actor(req));
  }

  @Get('duties')
  @RequirePermission('proxy-swap', 'view')
  async duties(@Query() q: any, @Req() req: any) {
    return { success: true, data: await this.service.duties(q, await this.actor(req)) };
  }

  @Post('duties')
  @RequirePermission('proxy-swap', 'add')
  async addDuty(@Body() b: any, @Req() req: any) {
    return { success: true, data: await this.service.saveDuty(null, b, await this.actor(req)), message: 'Duty saved' };
  }

  @Patch('duties/:id')
  @RequirePermission('proxy-swap', 'edit')
  async updateDuty(@Param('id') id: string, @Body() b: any, @Req() req: any) {
    return { success: true, data: await this.service.saveDuty(id, b, await this.actor(req)), message: 'Duty updated' };
  }

  @Delete('duties/:id')
  @RequirePermission('proxy-swap', 'delete')
  async removeDuty(@Param('id') id: string, @Req() req: any) {
    return this.service.removeDuty(id, await this.actor(req));
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OvertimeRecord.name, schema: OvertimeRecordSchema },
      { name: ProxyDuty.name, schema: ProxyDutySchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: AttendanceRecord.name, schema: AttendanceRecordSchema },
      { name: PayrollRun.name, schema: PayrollRunSchema },
    ]),
  ],
  controllers: [DutyOvertimeController],
  providers: [DutyOvertimeService],
})
export class DutyOvertimeModule {}
