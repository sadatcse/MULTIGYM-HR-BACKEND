import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { CASE_STATUSES, CASE_TYPES, DECISION_ACTIONS, DisciplinaryCase, DisciplinaryCaseDocument, ENTRY_TYPES } from './schemas/disciplinary-case.schema';
import { Actor, HrAccessService } from '../hr-config/hr-access.service';
import { EmployeeHistoryService, snapshotOf } from '../employee-history/employee-history.service';
import { createWithRefNo } from '../../common/helpers/ref-no.helper';
import { isDateStr, todayStr } from '../../common/helpers/hr-date.helper';

// Case types / decisions that also belong on the employee's career history.
const HISTORY_FOR_CASE: Record<string, string> = { written_warning: 'warning', show_cause: 'show_cause', suspension: 'suspension' };
const HISTORY_FOR_DECISION: Record<string, string> = {
  written_warning: 'warning',
  final_warning: 'warning',
  suspension: 'suspension',
  demotion: 'demotion',
  transfer: 'transfer',
  termination: 'separation',
};

@Injectable()
export class DisciplineService {
  constructor(
    @InjectModel(DisciplinaryCase.name) private readonly model: Model<DisciplinaryCaseDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    private readonly access: HrAccessService,
    private readonly history: EmployeeHistoryService,
  ) {}

  private by(actor: Actor) {
    return { id: actor.id, name: actor.name, role: actor.role };
  }

  private assertManage(actor: Actor) {
    if (actor.scope === 'self') throw new ForbiddenException('Discipline records are restricted to HR/management');
  }

  private assertCaseAccess(doc: any, actor: Actor) {
    this.assertManage(actor);
    if (actor.scope === 'branch' && (!actor.branches.includes(doc.branch) || doc.confidential)) {
      throw new ForbiddenException('You do not have access to this case');
    }
  }

  async create(dto: any, actor: Actor) {
    this.assertManage(actor);
    if (!CASE_TYPES.includes(dto.caseType)) throw new BadRequestException('Invalid case type');
    if (!dto.subject || !String(dto.subject).trim()) throw new BadRequestException('Subject is required');
    if (dto.incidentDate && !isDateStr(dto.incidentDate)) throw new BadRequestException('Incident date must be YYYY-MM-DD');
    const emp = await this.employeeModel.findById(dto.employeeId).lean();
    if (!emp) throw new NotFoundException('Employee not found');
    this.access.assertCanAccess(actor, String(emp._id), emp.branches);
    if (String(emp._id) === actor.id) throw new BadRequestException('You cannot open a case against yourself');

    const initialStatus = dto.caseType === 'show_cause' ? 'awaiting_reply' : dto.caseType === 'investigation' || dto.caseType === 'complaint' ? 'under_investigation' : 'open';
    const firstEntryType = dto.caseType === 'show_cause' ? 'show_cause_issued' : dto.caseType.endsWith('warning') ? 'warning_issued' : 'note';
    const attachments = (dto.attachments || []).filter((a: any) => a?.url);

    const doc: any = await createWithRefNo(this.model, 'caseNo', 'DC', {
      employee: emp._id,
      employeeName: emp.name,
      employeeCode: emp.employeeId || '',
      employeePhoto: emp.photo || '',
      designation: emp.jobPosition || '',
      branch: emp.branches?.[0] || '',
      caseType: dto.caseType,
      subject: String(dto.subject).trim(),
      description: dto.description || '',
      incidentDate: dto.incidentDate || todayStr(),
      complainant: dto.complainant || '',
      severity: ['low', 'medium', 'high', 'critical'].includes(dto.severity) ? dto.severity : 'medium',
      status: initialStatus,
      replyDeadline: dto.replyDeadline || '',
      letterNumber: dto.letterNumber || '',
      attachments,
      confidential: !!dto.confidential,
      createdBy: this.by(actor),
      entries: [
        {
          _id: randomUUID(),
          type: firstEntryType,
          text: dto.description || dto.subject,
          date: dto.incidentDate || todayStr(),
          attachments,
          by: this.by(actor),
          at: new Date(),
        },
      ],
    });

    const historyType = HISTORY_FOR_CASE[dto.caseType];
    if (historyType) {
      await this.history
        .record({
          employeeId: String(emp._id),
          eventType: historyType,
          effectiveDate: dto.incidentDate || todayStr(),
          title: `${historyType === 'warning' ? 'Written Warning' : historyType === 'show_cause' ? 'Show Cause Notice' : 'Suspension'} — ${doc.subject}`,
          description: dto.description || '',
          referenceNo: dto.letterNumber || doc.caseNo,
          sourceModule: 'discipline',
          sourceId: String(doc._id),
          recordedBy: this.by(actor),
        })
        .catch(() => null);
    }
    return doc;
  }

  async list(query: any, actor: Actor) {
    this.assertManage(actor);
    const filter: any = {};
    const branches = this.access.resolveBranchFilter(actor, query.branch);
    if (branches) filter.branch = { $in: branches };
    if (actor.scope === 'branch') filter.confidential = { $ne: true };
    if (query.employee) filter.employee = new Types.ObjectId(query.employee);
    if (query.caseType && query.caseType !== 'all') filter.caseType = query.caseType;
    if (query.status && query.status !== 'all') filter.status = query.status === 'active' ? { $ne: 'closed' } : query.status;
    if (query.search) {
      filter.$or = [
        { caseNo: { $regex: query.search, $options: 'i' } },
        { employeeName: { $regex: query.search, $options: 'i' } },
        { employeeCode: { $regex: query.search, $options: 'i' } },
        { subject: { $regex: query.search, $options: 'i' } },
      ];
    }
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(200, parseInt(query.limit, 10) || 20);
    const [total, data, byStatus, byType] = await Promise.all([
      this.model.countDocuments(filter),
      this.model.find(filter).select('-entries').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.model.aggregate([{ $match: filter }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      this.model.aggregate([{ $match: filter }, { $group: { _id: '$caseType', n: { $sum: 1 } } }]),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      stats: { byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])), byType: Object.fromEntries(byType.map((s) => [s._id, s.n])) },
    };
  }

  async findOne(id: string, actor: Actor) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Case not found');
    this.assertCaseAccess(doc, actor);
    const priorCases = await this.model
      .find({ employee: doc.employee, _id: { $ne: doc._id } })
      .select('caseNo caseType subject status createdAt decision')
      .sort({ createdAt: -1 })
      .lean();
    return { ...doc, priorCases };
  }

  async addEntry(id: string, dto: any, actor: Actor) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Case not found');
    this.assertCaseAccess(doc, actor);
    if (doc.status === 'closed') throw new BadRequestException('Case is closed — reopen it first');
    if (!ENTRY_TYPES.includes(dto.type)) throw new BadRequestException('Invalid entry type');
    if (!dto.text || !String(dto.text).trim()) throw new BadRequestException('Entry text is required');
    doc.entries.push({
      _id: randomUUID(),
      type: dto.type,
      text: String(dto.text).trim(),
      date: dto.date || todayStr(),
      attachments: (dto.attachments || []).filter((a: any) => a?.url),
      by: this.by(actor),
      at: new Date(),
    });
    if (dto.type === 'reply_received' && doc.status === 'awaiting_reply') doc.status = 'under_investigation';
    if ((dto.type === 'investigation' || dto.type === 'hearing') && doc.status === 'open') doc.status = 'under_investigation';
    if (dto.type === 'show_cause_issued') {
      doc.status = 'awaiting_reply';
      if (dto.replyDeadline) doc.replyDeadline = dto.replyDeadline;
    }
    if (dto.status && CASE_STATUSES.includes(dto.status) && dto.status !== 'closed') doc.status = dto.status;
    doc.markModified('entries');
    await doc.save();
    return doc;
  }

  // Management decision — optionally applied to the employee profile.
  async decide(id: string, dto: any, actor: Actor) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Case not found');
    this.assertCaseAccess(doc, actor);
    if (actor.scope !== 'all') throw new ForbiddenException('Only management can record the final decision');
    if (!DECISION_ACTIONS.includes(dto.action)) throw new BadRequestException('Invalid decision action');
    if (!dto.summary || !String(dto.summary).trim()) throw new BadRequestException('Decision summary is required');
    const effectiveDate = dto.effectiveDate || todayStr();
    doc.decision = {
      action: dto.action,
      summary: String(dto.summary).trim(),
      effectiveDate,
      suspensionDays: Number(dto.suspensionDays) || 0,
      deductionAmount: Number(dto.deductionAmount) || 0,
      decidedBy: this.by(actor),
      decidedAt: new Date(),
    };
    doc.status = 'decision_made';
    doc.entries.push({
      _id: randomUUID(),
      type: 'management_decision',
      text: `${dto.action.replace(/_/g, ' ')} — ${dto.summary}`,
      date: effectiveDate,
      attachments: (dto.attachments || []).filter((a: any) => a?.url),
      by: this.by(actor),
      at: new Date(),
    });
    doc.markModified('entries');
    await doc.save();

    const historyType = HISTORY_FOR_DECISION[dto.action];
    if (historyType) {
      const emp = await this.employeeModel.findById(doc.employee);
      const before = snapshotOf(emp);
      const after = { ...before };
      if (dto.applyToProfile && emp) {
        if (dto.action === 'suspension') emp.status = 'suspended';
        if (dto.action === 'termination') {
          emp.status = 'terminated';
          emp.lastWorkingDate = effectiveDate;
        }
        if (dto.action === 'demotion' && dto.newDesignation) emp.jobPosition = dto.newDesignation;
        if (dto.action === 'transfer' && dto.newBranch) emp.branches = [dto.newBranch];
        await emp.save();
        Object.assign(after, snapshotOf(emp));
      }
      await this.history
        .record({
          employeeId: String(doc.employee),
          eventType: historyType,
          effectiveDate,
          title: `Disciplinary decision: ${dto.action.replace(/_/g, ' ')}`,
          description: dto.summary,
          from: before,
          to: after,
          referenceNo: doc.letterNumber || doc.caseNo,
          sourceModule: 'discipline',
          sourceId: String(doc._id),
          recordedBy: this.by(actor),
        })
        .catch(() => null);
    }
    return doc;
  }

  async setStatus(id: string, dto: any, actor: Actor) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Case not found');
    this.assertCaseAccess(doc, actor);
    if (!CASE_STATUSES.includes(dto.status)) throw new BadRequestException('Invalid status');
    if (dto.status === 'closed' && actor.scope !== 'all') throw new ForbiddenException('Only management can close a case');
    const previous = doc.status;
    doc.status = dto.status;
    doc.entries.push({
      _id: randomUUID(),
      type: dto.status === 'closed' ? 'closed' : 'status_change',
      text: dto.remarks || `Status changed from ${previous} to ${dto.status}`,
      date: todayStr(),
      attachments: [],
      by: this.by(actor),
      at: new Date(),
    });
    doc.markModified('entries');
    await doc.save();
    return doc;
  }

  async update(id: string, dto: any, actor: Actor) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Case not found');
    this.assertCaseAccess(doc, actor);
    for (const k of ['subject', 'description', 'complainant', 'severity', 'replyDeadline', 'letterNumber', 'incidentDate']) {
      if (dto[k] !== undefined) (doc as any)[k] = dto[k];
    }
    if (dto.confidential !== undefined && actor.scope === 'all') doc.confidential = !!dto.confidential;
    if (Array.isArray(dto.attachments)) doc.attachments = dto.attachments.filter((a: any) => a?.url);
    await doc.save();
    return doc;
  }

  async remove(id: string, actor: Actor) {
    if (!actor.isSuperAdmin) throw new ForbiddenException('Only Super Admin can delete a disciplinary record');
    const doc = await this.model.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('Case not found');
    return { message: 'Case deleted' };
  }
}
