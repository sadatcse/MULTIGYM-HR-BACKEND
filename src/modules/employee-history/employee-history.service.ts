import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { CareerSnapshot, EmployeeHistory, EmployeeHistoryDocument, HISTORY_EVENT_TYPES } from './schemas/employee-history.schema';
import { Actor, HrAccessService } from '../hr-config/hr-access.service';
import { isDateStr, todayStr } from '../../common/helpers/hr-date.helper';

const TITLES: Record<string, string> = {
  appointment: 'Appointed',
  confirmation: 'Employment Confirmed',
  promotion: 'Promoted',
  demotion: 'Demoted',
  transfer: 'Transferred',
  promotion_transfer: 'Promoted & Transferred',
  salary_revision: 'Salary Revised',
  increment: 'Salary Increment',
  designation_change: 'Designation Changed',
  department_change: 'Department Changed',
  appreciation: 'Appreciation',
  warning: 'Warning Issued',
  show_cause: 'Show Cause Notice',
  suspension: 'Suspended',
  reinstatement: 'Reinstated',
  resignation: 'Resigned',
  separation: 'Separated',
  status_change: 'Status Changed',
  other: 'Record',
};

// Status an event moves the employee into when "apply to profile" is set.
const STATUS_FOR_EVENT: Record<string, string> = {
  confirmation: 'active',
  suspension: 'suspended',
  reinstatement: 'active',
  resignation: 'resigned',
  separation: 'terminated',
};

export interface RecordEventInput {
  employeeId: string;
  eventType: string;
  effectiveDate?: string;
  title?: string;
  description?: string;
  from?: CareerSnapshot;
  to?: CareerSnapshot;
  referenceNo?: string;
  sourceModule?: string;
  sourceId?: string;
  attachments?: Array<{ name: string; url: string }>;
  recordedBy?: { id: string; name: string; role: string } | null;
}

export function snapshotOf(emp: any): CareerSnapshot {
  return {
    designation: emp?.jobPosition || '',
    department: emp?.department || '',
    branches: [...(emp?.branches || [])],
    basicSalary: Number(emp?.basicSalary || 0),
    grossSalary: Number(emp?.grossSalary || 0),
    status: emp?.status || '',
    employeeType: emp?.employeeType || '',
  };
}

@Injectable()
export class EmployeeHistoryService {
  constructor(
    @InjectModel(EmployeeHistory.name) private readonly historyModel: Model<EmployeeHistoryDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    private readonly access: HrAccessService,
  ) {}

  async record(input: RecordEventInput) {
    if (!HISTORY_EVENT_TYPES.includes(input.eventType as any)) {
      throw new BadRequestException(`Unknown history event type "${input.eventType}"`);
    }
    const emp = await this.employeeModel.findById(input.employeeId).select('name employeeId branches').lean();
    if (!emp) throw new NotFoundException('Employee not found');
    return this.historyModel.create({
      employee: new Types.ObjectId(input.employeeId),
      employeeCode: emp.employeeId,
      employeeName: emp.name,
      branch: (input.to?.branches || emp.branches || [])[0] || '',
      eventType: input.eventType,
      effectiveDate: input.effectiveDate || todayStr(),
      title: input.title || TITLES[input.eventType] || 'Record',
      description: input.description || '',
      from: input.from || {},
      to: input.to || {},
      referenceNo: input.referenceNo || '',
      sourceModule: input.sourceModule || 'manual',
      sourceId: input.sourceId || '',
      attachments: input.attachments || [],
      recordedBy: input.recordedBy || null,
    });
  }

  // Called by EmployeeService after a profile save — turns field changes
  // into career events so the timeline builds itself from normal edits.
  async recordProfileChanges(employeeId: string, before: CareerSnapshot, after: CareerSnapshot, by?: RecordEventInput['recordedBy']) {
    const designationChanged = (before.designation || '') !== (after.designation || '');
    const branchChanged = [...(before.branches || [])].sort().join('|') !== [...(after.branches || [])].sort().join('|');
    const deptChanged = (before.department || '') !== (after.department || '');
    const salaryChanged = Number(before.grossSalary || 0) !== Number(after.grossSalary || 0) || Number(before.basicSalary || 0) !== Number(after.basicSalary || 0);
    const statusChanged = (before.status || '') !== (after.status || '');

    const events: string[] = [];
    if (designationChanged && branchChanged) events.push('promotion_transfer');
    else if (designationChanged) events.push('designation_change');
    else if (branchChanged) events.push('transfer');
    if (deptChanged && !designationChanged) events.push('department_change');
    if (salaryChanged) events.push(Number(after.grossSalary || 0) >= Number(before.grossSalary || 0) ? 'increment' : 'salary_revision');
    if (statusChanged) {
      const map: Record<string, string> = { active: before.status === 'suspended' ? 'reinstatement' : 'confirmation', suspended: 'suspension', resigned: 'resignation', terminated: 'separation' };
      events.push(map[after.status || ''] || 'status_change');
    }
    for (const eventType of events) {
      await this.record({ employeeId, eventType, from: before, to: after, sourceModule: 'employee', recordedBy: by || null, description: 'Recorded automatically from a profile update.' });
    }
  }

  async createManual(dto: any, actor: Actor) {
    if (!dto.employeeId) throw new BadRequestException('employeeId is required');
    if (!HISTORY_EVENT_TYPES.includes(dto.eventType)) throw new BadRequestException('Invalid event type');
    if (dto.effectiveDate && !isDateStr(dto.effectiveDate)) throw new BadRequestException('effectiveDate must be YYYY-MM-DD');
    const emp = await this.employeeModel.findById(dto.employeeId);
    if (!emp) throw new NotFoundException('Employee not found');
    this.access.assertCanAccess(actor, String(emp._id), emp.branches);

    const before = snapshotOf(emp);
    const to: CareerSnapshot = { ...before };
    const changes = dto.to || {};
    if (changes.designation) to.designation = changes.designation;
    if (changes.department) to.department = changes.department;
    if (Array.isArray(changes.branches) && changes.branches.length) to.branches = changes.branches;
    if (changes.basicSalary !== undefined && changes.basicSalary !== '') to.basicSalary = Number(changes.basicSalary);
    if (changes.grossSalary !== undefined && changes.grossSalary !== '') to.grossSalary = Number(changes.grossSalary);
    if (STATUS_FOR_EVENT[dto.eventType]) to.status = STATUS_FOR_EVENT[dto.eventType];

    if (dto.applyToProfile) {
      emp.jobPosition = to.designation;
      emp.department = to.department;
      emp.branches = to.branches || [];
      emp.basicSalary = to.basicSalary;
      emp.grossSalary = to.grossSalary;
      if (to.status) emp.status = to.status;
      if (dto.eventType === 'resignation' || dto.eventType === 'separation') {
        emp.lastWorkingDate = dto.effectiveDate || todayStr();
        if (dto.eventType === 'resignation' && !emp.resignationDate) emp.resignationDate = dto.effectiveDate || todayStr();
      }
      await emp.save();
    }

    return this.record({
      employeeId: dto.employeeId,
      eventType: dto.eventType,
      effectiveDate: dto.effectiveDate,
      title: dto.title,
      description: dto.description,
      from: before,
      to,
      referenceNo: dto.referenceNo,
      sourceModule: 'manual',
      attachments: dto.attachments,
      recordedBy: { id: actor.id, name: actor.name, role: actor.role },
    });
  }

  async list(query: any, actor: Actor) {
    const filter: Record<string, any> = this.access.scopeFilter(actor, 'employee', 'branch');
    if (filter.employee) filter.employee = new Types.ObjectId(filter.employee);
    if (query.employee) {
      if (actor.scope === 'self' && query.employee !== actor.id) return { data: [], total: 0, totalPages: 1 };
      filter.employee = new Types.ObjectId(query.employee);
    }
    if (query.eventType && query.eventType !== 'all') filter.eventType = query.eventType;
    if (query.branch && query.branch !== 'all' && actor.scope === 'all') filter.branch = query.branch;
    if (query.from || query.to) {
      filter.effectiveDate = {};
      if (query.from) filter.effectiveDate.$gte = query.from;
      if (query.to) filter.effectiveDate.$lte = query.to;
    }
    if (query.search) {
      filter.$or = [
        { employeeName: { $regex: query.search, $options: 'i' } },
        { employeeCode: { $regex: query.search, $options: 'i' } },
        { title: { $regex: query.search, $options: 'i' } },
        { referenceNo: { $regex: query.search, $options: 'i' } },
      ];
    }
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(200, parseInt(query.limit, 10) || 20);
    const [total, data] = await Promise.all([
      this.historyModel.countDocuments(filter),
      this.historyModel.find(filter).sort({ effectiveDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  // Full career timeline for one employee, oldest first. Employees created
  // before this module existed get a synthesized appointment entry from
  // their joining date so the timeline always has a starting point.
  async timeline(employeeId: string, actor: Actor) {
    const emp = await this.employeeModel.findById(employeeId).select('-password').lean();
    if (!emp) throw new NotFoundException('Employee not found');
    this.access.assertCanAccess(actor, String(emp._id), emp.branches);
    const events: any[] = await this.historyModel.find({ employee: new Types.ObjectId(employeeId) }).sort({ effectiveDate: 1, createdAt: 1 }).lean();
    if (!events.some((e) => e.eventType === 'appointment') && emp.joiningDate) {
      events.unshift({
        _id: `synthetic-${employeeId}`,
        eventType: 'appointment',
        effectiveDate: emp.joiningDate,
        title: 'Joined',
        description: 'Joining date from employee profile.',
        to: { designation: emp.jobPosition, department: emp.department, branches: emp.branches },
        synthetic: true,
      });
    }
    return { employee: emp, events };
  }

  async remove(id: string, actor: Actor) {
    const doc = await this.historyModel.findById(id);
    if (!doc) throw new NotFoundException('History record not found');
    if (actor.scope !== 'all') throw new BadRequestException('Only HR/management can delete history records');
    await doc.deleteOne();
    return { message: 'History record deleted' };
  }
}
