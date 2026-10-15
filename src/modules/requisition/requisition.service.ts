import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { Requisition, RequisitionDocument } from './schemas/requisition.schema';
import { Actor, HrAccessService } from '../hr-config/hr-access.service';
import { createWithRefNo } from '../../common/helpers/ref-no.helper';
import { isDateStr, todayStr } from '../../common/helpers/hr-date.helper';

type Action = 'verify' | 'approve' | 'reject' | 'order' | 'purchase' | 'receive' | 'cancel';

const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

@Injectable()
export class RequisitionService {
  constructor(
    @InjectModel(Requisition.name) private readonly model: Model<RequisitionDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    private readonly access: HrAccessService,
  ) {}

  private async roles(actor: Actor) {
    const cfg = await this.access.getConfig();
    const s = cfg.requisitionStages;
    const sa = actor.isSuperAdmin;
    return {
      admin: sa || this.access.roleIn(actor.role, s.admin),
      management: sa || this.access.roleIn(actor.role, s.management),
      purchase: sa || this.access.roleIn(actor.role, s.purchase),
    };
  }

  // Which actions the actor may take on this requisition right now.
  async availableActions(req: any, actor: Actor): Promise<Action[]> {
    const r = await this.roles(actor);
    const isRequester = req.requestedBy?.id === actor.id;
    const branchLead = actor.scope === 'branch' && actor.branches.includes(req.branch);
    const out: Action[] = [];
    switch (req.status) {
      case 'submitted':
        if (r.admin) out.push('verify', 'reject');
        if (r.management) out.push('approve', 'reject');
        if (isRequester || actor.scope === 'all') out.push('cancel');
        break;
      case 'verified':
        if (r.management) out.push('approve', 'reject');
        if (actor.scope === 'all') out.push('cancel');
        break;
      case 'approved':
        if (r.purchase) {
          if (req.purchaseStatus === 'not_started') out.push('order');
          out.push('purchase');
        }
        if (actor.scope === 'all') out.push('cancel');
        break;
      case 'purchased':
        if (r.purchase || isRequester || branchLead || actor.scope === 'all') out.push('receive');
        break;
    }
    return [...new Set(out)];
  }

  private cleanItems(items: any[]) {
    if (!Array.isArray(items) || !items.length) throw new BadRequestException('Add at least one item');
    return items.map((i) => {
      if (!i?.name || !String(i.name).trim()) throw new BadRequestException('Every item needs a name');
      const qty = Number(i.quantity);
      if (!(qty > 0)) throw new BadRequestException(`Quantity for "${i.name}" must be greater than 0`);
      return {
        name: String(i.name).trim(),
        specification: i.specification || '',
        quantity: qty,
        unit: i.unit || 'pcs',
        estimatedUnitPrice: round(i.estimatedUnitPrice),
        approvedQuantity: null,
        receivedQuantity: 0,
      };
    });
  }

  private push(doc: any, action: string, remarks: string, actor: Actor) {
    doc.timeline.push({ action, status: doc.status, remarks: remarks || '', by: { id: actor.id, name: actor.name, role: actor.role }, at: new Date() });
    doc.markModified('timeline');
  }

  async create(dto: any, actor: Actor) {
    const me = await this.employeeModel.findById(actor.id).select('employeeId jobPosition department branches').lean();
    const branch = dto.branch || me?.branches?.[0];
    if (!branch) throw new BadRequestException('Branch is required');
    if (actor.scope !== 'all' && !actor.branches.includes(branch)) throw new ForbiddenException('You can only raise requisitions for your own branch');
    if (!dto.title || !String(dto.title).trim()) throw new BadRequestException('Title is required');
    if (dto.requiredBy && !isDateStr(dto.requiredBy)) throw new BadRequestException('Required-by date must be YYYY-MM-DD');
    const items = this.cleanItems(dto.items);
    const doc: any = await createWithRefNo(this.model, 'requisitionNo', 'REQ', {
      title: String(dto.title).trim(),
      branch,
      department: dto.department || me?.department || '',
      requestedBy: { id: actor.id, name: actor.name, employeeCode: me?.employeeId || '', designation: me?.jobPosition || '' },
      purpose: dto.purpose || '',
      priority: ['low', 'normal', 'high', 'urgent'].includes(dto.priority) ? dto.priority : 'normal',
      requiredBy: dto.requiredBy || '',
      items,
      estimatedTotal: round(items.reduce((s, i) => s + i.quantity * i.estimatedUnitPrice, 0)),
      attachments: (dto.attachments || []).filter((a: any) => a?.url),
      status: 'submitted',
      timeline: [],
    });
    this.push(doc, 'submitted', dto.purpose || '', actor);
    await doc.save();
    return doc;
  }

  async update(id: string, dto: any, actor: Actor) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Requisition not found');
    if (doc.status !== 'submitted') throw new BadRequestException('Only a submitted requisition can be edited');
    if (doc.requestedBy.id !== actor.id && actor.scope !== 'all') throw new ForbiddenException('Only the requester can edit this requisition');
    if (dto.title) doc.title = dto.title;
    if (dto.purpose !== undefined) doc.purpose = dto.purpose;
    if (dto.priority) doc.priority = dto.priority;
    if (dto.requiredBy !== undefined) doc.requiredBy = dto.requiredBy;
    if (dto.items) {
      doc.items = this.cleanItems(dto.items) as any;
      doc.estimatedTotal = round(doc.items.reduce((s, i) => s + i.quantity * (i.estimatedUnitPrice || 0), 0));
    }
    if (dto.attachments) doc.attachments = dto.attachments.filter((a: any) => a?.url);
    this.push(doc, 'edited', '', actor);
    await doc.save();
    return doc;
  }

  async list(query: any, actor: Actor) {
    const filter: any = {};
    if (actor.scope === 'self') filter['requestedBy.id'] = actor.id;
    else {
      const branches = this.access.resolveBranchFilter(actor, query.branch);
      if (branches) filter.branch = { $in: branches };
    }
    if (query.mine === 'true') filter['requestedBy.id'] = actor.id;
    if (query.status && query.status !== 'all') filter.status = query.status === 'open' ? { $in: ['submitted', 'verified', 'approved', 'purchased'] } : query.status;
    if (query.priority && query.priority !== 'all') filter.priority = query.priority;
    if (query.search) {
      filter.$or = [
        { requisitionNo: { $regex: query.search, $options: 'i' } },
        { title: { $regex: query.search, $options: 'i' } },
        { 'items.name': { $regex: query.search, $options: 'i' } },
        { vendorName: { $regex: query.search, $options: 'i' } },
      ];
    }
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(200, parseInt(query.limit, 10) || 20);
    const [total, data, counts] = await Promise.all([
      this.model.countDocuments(filter),
      this.model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.model.aggregate([{ $match: filter }, { $group: { _id: '$status', n: { $sum: 1 }, amount: { $sum: '$approvedAmount' } } }]),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1, stats: Object.fromEntries(counts.map((c) => [c._id, c.n])) };
  }

  // Requisitions waiting on this actor's role.
  async pendingForMe(actor: Actor) {
    const r = await this.roles(actor);
    const statuses: string[] = [];
    if (r.admin) statuses.push('submitted');
    if (r.management) statuses.push('submitted', 'verified');
    if (r.purchase) statuses.push('approved');
    if (!statuses.length) return [];
    const filter: any = { status: { $in: [...new Set(statuses)] } };
    if (actor.scope === 'branch') filter.branch = { $in: actor.branches };
    return this.model.find(filter).sort({ createdAt: 1 }).lean();
  }

  async findOne(id: string, actor: Actor) {
    const doc: any = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Requisition not found');
    const actions = await this.availableActions(doc, actor);
    if (!actions.length && doc.requestedBy?.id !== actor.id) {
      if (actor.scope === 'self') throw new ForbiddenException('You do not have access to this requisition');
      if (actor.scope === 'branch' && !actor.branches.includes(doc.branch)) throw new ForbiddenException('Not your branch');
    }
    const r = await this.roles(actor);
    return { ...doc, availableActions: actions, canQuote: (r.admin || r.purchase) && ['submitted', 'verified', 'approved'].includes(doc.status) };
  }

  async addQuotation(id: string, dto: any, actor: Actor) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Requisition not found');
    const r = await this.roles(actor);
    if (!r.admin && !r.purchase) throw new ForbiddenException('Only admin/purchase can add quotations');
    if (!['submitted', 'verified', 'approved'].includes(doc.status)) throw new BadRequestException('Quotations are closed for this requisition');
    if (!dto.vendorName || !(Number(dto.amount) > 0)) throw new BadRequestException('Vendor and amount are required');
    doc.quotations.push({
      vendorId: dto.vendorId || '',
      vendorName: dto.vendorName,
      amount: round(dto.amount),
      deliveryDays: Number(dto.deliveryDays) || 0,
      note: dto.note || '',
      attachmentUrl: dto.attachmentUrl || '',
      selected: false,
      addedBy: actor.name,
      addedAt: new Date(),
    });
    this.push(doc, 'quotation_added', `${dto.vendorName}: ${round(dto.amount)}`, actor);
    await doc.save();
    return doc;
  }

  async removeQuotation(id: string, quotationId: string, actor: Actor) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Requisition not found');
    const r = await this.roles(actor);
    if (!r.admin && !r.purchase) throw new ForbiddenException('Not allowed');
    if (!['submitted', 'verified'].includes(doc.status)) throw new BadRequestException('Quotations are locked after approval');
    doc.quotations = doc.quotations.filter((q) => String(q._id) !== quotationId) as any;
    await doc.save();
    return doc;
  }

  async act(id: string, dto: any, actor: Actor) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Requisition not found');
    const action = dto.action as Action;
    const allowed = await this.availableActions(doc.toObject(), actor);
    if (!allowed.includes(action)) throw new ForbiddenException(`You cannot "${action}" this requisition now`);
    const remarks = String(dto.remarks || '').trim();

    switch (action) {
      case 'verify':
        doc.status = 'verified';
        break;
      case 'approve': {
        const amount = round(dto.approvedAmount ?? doc.estimatedTotal);
        if (!(amount > 0)) throw new BadRequestException('Approved amount is required');
        doc.approvedAmount = amount;
        if (dto.quotationId) {
          const q = doc.quotations.find((x) => String(x._id) === dto.quotationId);
          if (!q) throw new BadRequestException('Selected quotation not found');
          doc.quotations.forEach((x) => (x.selected = String(x._id) === dto.quotationId));
          doc.vendorId = q.vendorId || '';
          doc.vendorName = q.vendorName;
          doc.markModified('quotations');
        } else if (dto.vendorName) {
          doc.vendorName = dto.vendorName;
          doc.vendorId = dto.vendorId || '';
        }
        if (Array.isArray(dto.approvedQuantities)) {
          for (const aq of dto.approvedQuantities) {
            const item = doc.items.find((i) => String(i._id) === aq.itemId);
            if (item) item.approvedQuantity = Math.max(0, Number(aq.quantity) || 0);
          }
          doc.markModified('items');
        }
        doc.status = 'approved';
        break;
      }
      case 'reject':
        if (!remarks) throw new BadRequestException('A reason is required to reject');
        doc.status = 'rejected';
        break;
      case 'order':
        doc.purchaseStatus = 'ordered';
        if (dto.vendorName) doc.vendorName = dto.vendorName;
        break;
      case 'purchase': {
        const actual = round(dto.actualAmount);
        if (!(actual > 0)) throw new BadRequestException('Actual purchase amount is required');
        doc.purchase = {
          date: dto.date || todayStr(),
          invoiceNo: dto.invoiceNo || '',
          actualAmount: actual,
          paymentMethod: dto.paymentMethod || '',
          note: remarks,
        };
        if (dto.vendorName) doc.vendorName = dto.vendorName;
        doc.purchaseStatus = 'purchased';
        doc.status = 'purchased';
        break;
      }
      case 'receive': {
        if (Array.isArray(dto.receivedItems)) {
          for (const ri of dto.receivedItems) {
            const item = doc.items.find((i) => String(i._id) === ri.itemId);
            if (item) item.receivedQuantity = Math.max(0, Number(ri.quantity) || 0);
          }
        } else {
          doc.items.forEach((i) => (i.receivedQuantity = i.approvedQuantity ?? i.quantity));
        }
        doc.markModified('items');
        const complete = doc.items.every((i) => (i.receivedQuantity || 0) >= (i.approvedQuantity ?? i.quantity));
        doc.deliveryStatus = complete ? 'delivered' : 'partial';
        doc.receipt = { date: dto.date || todayStr(), receivedBy: actor.name, condition: dto.condition || 'good', note: remarks };
        if (complete) doc.status = 'received';
        break;
      }
      case 'cancel':
        doc.status = 'cancelled';
        break;
    }
    this.push(doc, action, remarks, actor);
    await doc.save();
    return doc;
  }
}
