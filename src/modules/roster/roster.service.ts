import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import {
  DUTY_TYPES,
  DUTY_TYPE_LABELS,
  RosterAssignment,
  RosterAssignmentDocument,
  RosterChangeLog,
  RosterChangeLogDocument,
} from './schemas/roster.schema';
import { Actor, HrAccessService } from '../hr-config/hr-access.service';
import { addDays, diffDays, isDateStr } from '../../common/helpers/hr-date.helper';

const TRACKED = ['branch', 'date', 'dutyType', 'startTime', 'endTime', 'isTemporary', 'note'];
const pick = (doc: any) => (doc ? Object.fromEntries(TRACKED.map((k) => [k, doc[k]])) : null);

@Injectable()
export class RosterService {
  constructor(
    @InjectModel(RosterAssignment.name) private readonly rosterModel: Model<RosterAssignmentDocument>,
    @InjectModel(RosterChangeLog.name) private readonly logModel: Model<RosterChangeLogDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    private readonly access: HrAccessService,
  ) {}

  dutyTypes() {
    return DUTY_TYPES.map((value) => ({ value, label: DUTY_TYPE_LABELS[value] }));
  }

  private assertBranch(actor: Actor, branch: string) {
    if (actor.scope === 'all') return;
    if (actor.scope === 'branch' && actor.branches.includes(branch)) return;
    throw new ForbiddenException(`You cannot manage the roster of ${branch}`);
  }

  private log(entry: Record<string, any>, actor: Actor) {
    return this.logModel.create({ ...entry, changedBy: { id: actor.id, name: actor.name, role: actor.role } });
  }

  async list(query: any, actor: Actor) {
    const from = query.from;
    const to = query.to || query.from;
    if (!isDateStr(from) || !isDateStr(to)) throw new BadRequestException('from/to must be YYYY-MM-DD');
    if (diffDays(from, to) > 62) throw new BadRequestException('Range too large (max 62 days)');
    const filter: any = { date: { $gte: from, $lte: to } };
    const branches = this.access.resolveBranchFilter(actor, query.branch);
    if (actor.scope === 'self') filter.employee = new Types.ObjectId(actor.id);
    else if (branches) filter.branch = { $in: branches };
    if (query.employee) filter.employee = new Types.ObjectId(query.employee);
    if (actor.scope === 'self') filter.employee = new Types.ObjectId(actor.id); // scope always wins over query
    const data = await this.rosterModel.find(filter).sort({ date: 1, startTime: 1 }).lean();
    return data;
  }

  // Employees whose roster the actor can plan for a branch.
  async branchStaff(branch: string, actor: Actor) {
    this.assertBranch(actor, branch);
    return this.employeeModel
      .find({ branches: branch, status: { $nin: ['resigned', 'terminated', 'inactive'] } })
      .select('name employeeId jobPosition department photo dutyInTime dutyOutTime')
      .sort({ name: 1 })
      .lean();
  }

  // Bulk upsert of duties: [{ employeeId, branch, date, dutyType, startTime, endTime, isTemporary, note }]
  async upsertMany(items: any[], actor: Actor, reason = '') {
    if (!Array.isArray(items) || !items.length) throw new BadRequestException('No roster entries provided');
    if (items.length > 1000) throw new BadRequestException('Too many entries in one request');
    const empIds = [...new Set(items.map((i) => String(i.employeeId)))];
    const emps = await this.employeeModel.find({ _id: { $in: empIds } }).select('name employeeId jobPosition').lean();
    const empMap = new Map(emps.map((e) => [String(e._id), e]));

    const results: any[] = [];
    for (const item of items) {
      if (!isDateStr(item.date)) throw new BadRequestException(`Invalid date "${item.date}"`);
      if (!DUTY_TYPES.includes(item.dutyType)) throw new BadRequestException(`Invalid duty type "${item.dutyType}"`);
      if (!item.branch) throw new BadRequestException('Branch is required');
      this.assertBranch(actor, item.branch);
      const emp = empMap.get(String(item.employeeId));
      if (!emp) throw new NotFoundException(`Employee ${item.employeeId} not found`);

      // A day off replaces any duties that day, and a duty replaces an "off".
      if (item.dutyType === 'off') {
        const removed = await this.rosterModel.find({ employee: emp._id, date: item.date, dutyType: { $ne: 'off' } });
        for (const r of removed) {
          await r.deleteOne();
          await this.log({ employee: emp._id, employeeName: emp.name, branch: r.branch, date: r.date, action: 'deleted', before: pick(r), reason: reason || 'Replaced by day off' }, actor);
        }
      } else {
        await this.rosterModel.deleteOne({ employee: emp._id, date: item.date, dutyType: 'off' });
      }

      const existing = await this.rosterModel.findOne({ employee: emp._id, date: item.date, dutyType: item.dutyType });
      const payload = {
        employee: emp._id,
        employeeName: emp.name,
        employeeCode: emp.employeeId || '',
        designation: emp.jobPosition || '',
        branch: item.branch,
        date: item.date,
        dutyType: item.dutyType,
        startTime: item.dutyType === 'off' ? '' : item.startTime || '',
        endTime: item.dutyType === 'off' ? '' : item.endTime || '',
        isTemporary: !!item.isTemporary,
        note: item.note || '',
      };
      if (existing) {
        const before = pick(existing);
        Object.assign(existing, payload, { updatedBy: { id: actor.id, name: actor.name } });
        await existing.save();
        if (JSON.stringify(before) !== JSON.stringify(pick(existing))) {
          await this.log({ employee: emp._id, employeeName: emp.name, branch: item.branch, date: item.date, action: 'updated', before, after: pick(existing), reason }, actor);
        }
        results.push(existing);
      } else {
        const created = await this.rosterModel.create({ ...payload, createdBy: { id: actor.id, name: actor.name } });
        await this.log({ employee: emp._id, employeeName: emp.name, branch: item.branch, date: item.date, action: 'created', after: pick(created), reason }, actor);
        results.push(created);
      }
    }
    return results;
  }

  async update(id: string, dto: any, actor: Actor) {
    const doc = await this.rosterModel.findById(id);
    if (!doc) throw new NotFoundException('Roster entry not found');
    this.assertBranch(actor, doc.branch);
    if (dto.branch) this.assertBranch(actor, dto.branch);
    if (dto.dutyType && !DUTY_TYPES.includes(dto.dutyType)) throw new BadRequestException('Invalid duty type');
    const before = pick(doc);
    for (const k of ['branch', 'dutyType', 'startTime', 'endTime', 'isTemporary', 'note']) {
      if (dto[k] !== undefined) (doc as any)[k] = dto[k];
    }
    doc.updatedBy = { id: actor.id, name: actor.name };
    try {
      await doc.save();
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('This employee already has that duty on this date');
      throw e;
    }
    await this.log({ employee: doc.employee, employeeName: doc.employeeName, branch: doc.branch, date: doc.date, action: 'updated', before, after: pick(doc), reason: dto.reason || '' }, actor);
    return doc;
  }

  async remove(id: string, actor: Actor, reason = '') {
    const doc = await this.rosterModel.findById(id);
    if (!doc) throw new NotFoundException('Roster entry not found');
    this.assertBranch(actor, doc.branch);
    await doc.deleteOne();
    await this.log({ employee: doc.employee, employeeName: doc.employeeName, branch: doc.branch, date: doc.date, action: 'deleted', before: pick(doc), reason }, actor);
    return { message: 'Roster entry removed' };
  }

  // Copies a 7-day block of a branch roster onto another week.
  async copyWeek(dto: { branch: string; sourceStart: string; targetStart: string; overwrite?: boolean }, actor: Actor) {
    if (!isDateStr(dto.sourceStart) || !isDateStr(dto.targetStart)) throw new BadRequestException('Dates must be YYYY-MM-DD');
    this.assertBranch(actor, dto.branch);
    const offset = diffDays(dto.sourceStart, dto.targetStart);
    const source = await this.rosterModel.find({ branch: dto.branch, date: { $gte: dto.sourceStart, $lte: addDays(dto.sourceStart, 6) } }).lean();
    if (dto.overwrite) {
      await this.rosterModel.deleteMany({ branch: dto.branch, date: { $gte: dto.targetStart, $lte: addDays(dto.targetStart, 6) } });
    }
    let copied = 0;
    for (const s of source) {
      const date = addDays(s.date, offset);
      const res = await this.rosterModel.updateOne(
        { employee: s.employee, date, dutyType: s.dutyType },
        {
          $setOnInsert: {
            employee: s.employee,
            employeeName: s.employeeName,
            employeeCode: s.employeeCode,
            designation: s.designation,
            branch: s.branch,
            date,
            dutyType: s.dutyType,
            startTime: s.startTime,
            endTime: s.endTime,
            isTemporary: false,
            note: s.note,
            createdBy: { id: actor.id, name: actor.name },
          },
        },
        { upsert: true },
      );
      if (res.upsertedCount) copied++;
    }
    await this.log({ employee: null, employeeName: '', branch: dto.branch, date: dto.targetStart, action: 'copied', after: { sourceStart: dto.sourceStart, targetStart: dto.targetStart, copied }, reason: 'Copy week' }, actor);
    return { copied, sourceCount: source.length };
  }

  async history(query: any, actor: Actor) {
    const filter: any = {};
    if (actor.scope === 'self') filter.employee = new Types.ObjectId(actor.id);
    const branches = this.access.resolveBranchFilter(actor, query.branch);
    if (actor.scope !== 'self' && branches) filter.branch = { $in: branches };
    if (query.employee) filter.employee = new Types.ObjectId(query.employee);
    if (actor.scope === 'self') filter.employee = new Types.ObjectId(actor.id); // scope always wins over query
    if (query.from || query.to) {
      filter.date = {};
      if (query.from) filter.date.$gte = query.from;
      if (query.to) filter.date.$lte = query.to;
    }
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(200, parseInt(query.limit, 10) || 30);
    const [total, data] = await Promise.all([
      this.logModel.countDocuments(filter),
      this.logModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }
}
