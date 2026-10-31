import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { HrLetterTemplate, HrLetterTemplateDocument } from './schemas/hr-letter-template.schema';
import { EmployeeHrLetter, EmployeeHrLetterDocument } from './schemas/employee-hr-letter.schema';
import { HrLetterAuditLog, HrLetterAuditLogDocument } from './schemas/hr-letter-audit-log.schema';
import { HrLetterCounter, HrLetterCounterDocument } from './schemas/hr-letter-counter.schema';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { Setting, SettingDocument } from '../setting/schemas/setting.schema';
import { Branch, BranchDocument } from '../branch/schemas/branch.schema';
import { Actor, HrAccessService } from '../hr-config/hr-access.service';
import { DEFAULT_HR_LETTER_TEMPLATES } from './default-templates.data';
import { CreateLetterDto, LetterSignatoriesDto, PreviewLetterDto, UpdateDraftDto } from './dto/create-letter.dto';
import { ReissueLetterDto } from './dto/reissue-letter.dto';
import { QueryLetterDto } from './dto/query-letter.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { fieldTypeOf, fillPlaceholders, formatBanglaDate, formatFieldValue } from './letter-format.helper';
import { escapeRegex } from '../../common/helpers/sanitize.helper';

type ReqMeta = { ip?: string; userAgent?: string };
type Who = { id: any; name: string; role: string };

// Letters that are the current, official version (not drafts, not voided,
// not superseded by a reissue).
const ISSUED_STATUSES = ['generated', 'issued'];

// Light projection for lists — the full snapshot (clauses, signatories)
// is only loaded when a single letter is opened.
const LIST_FIELDS = {
  employeeId: 1,
  employeeCode: 1,
  employeeName: 1,
  employeePhoto: 1,
  letterType: 1,
  letterNumber: 1,
  letterDate: 1,
  effectiveDate: 1,
  branch: 1,
  department: 1,
  designation: 1,
  status: 1,
  version: 1,
  fileName: 1,
  inputData: 1,
  remarks: 1,
  reissueReason: 1,
  cancelReason: 1,
  generatedBy: 1,
  generatedAt: 1,
  issuedAt: 1,
  cancelledAt: 1,
  createdAt: 1,
  updatedAt: 1,
  'contentSnapshot.letterMeta': 1,
};

// Employee self-service ("My Letters"): only official letters addressed to
// the signed-in employee — never drafts, superseded versions, internal
// notes, raw form input or who prepared them.
const MY_STATUSES = ['generated', 'issued', 'cancelled'];
const MY_LIST_FIELDS = {
  letterType: 1,
  letterNumber: 1,
  letterDate: 1,
  effectiveDate: 1,
  status: 1,
  version: 1,
  fileName: 1,
  branch: 1,
  designation: 1,
  issuedAt: 1,
  cancelledAt: 1,
  createdAt: 1,
  'contentSnapshot.letterMeta': 1,
};
const MY_HIDDEN_FIELDS = { inputData: 0, remarks: 0, generatedBy: 0, updatedBy: 0, cancelledBy: 0, cancelReason: 0, reissueReason: 0, templateId: 0, parentLetterId: 0 };

const SORTABLE = new Set(['createdAt', 'letterDate', 'employeeName', 'letterNumber', 'letterType', 'status']);

const FALLBACK_SIGNATORIES = {
  issuedBy: { name: 'মোঃ ফয়জুর রহমান মানিক', designation: 'Manager: Admin & HR', title: 'Senior Trainer' },
  approvedBy: {
    name: 'কর্নেল মোঃ বনী ইয়ামীন (অবঃ)',
    designation: 'পরিচালক',
    company: 'মাল্টি জিম প্রিমিয়াম ও মাল্টি জিম',
    onBehalfOf: 'পক্ষে, ব্যবস্থাপনা পরিচালক',
  },
  copyTo: [
    'ব্যবস্থাপনা পরিচালক, মাল্টি জিম প্রিমিয়াম ও মাল্টি জিম',
    'পরিচালক, মাল্টি জিম প্রিমিয়াম ও মাল্টি জিম',
    'ম্যানেজার এডমিন',
    'ম্যানেজার একাউন্টস',
  ],
};

// Stand-in employee for the template preview screen.
const SAMPLE_EMPLOYEE: any = {
  _id: null,
  employeeId: 'EMP-0001',
  name: 'মোহাম্মদ রফিকুল ইসলাম',
  jobPosition: 'Senior Fitness Trainer',
  department: 'Gym Operations',
  branches: ['Dhanmondi'],
  joiningDate: '2024-01-01',
  mobileNumber: '+880 1711-000000',
  nidPassport: '1234567890',
};

const today = () => new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10);
const yearOf = (isoDate?: string) => Number(String(isoDate || today()).slice(0, 4)) || new Date().getFullYear();
const pick = (...vals: any[]) => vals.find((v) => v !== undefined && v !== null && String(v).trim() !== '');

const addressText = (a: any) =>
  a && typeof a === 'object' ? [a.addressLine1, a.addressLine2, a.area, a.city, a.district].filter(Boolean).join(', ') : a || '';

@Injectable()
export class HrLetterService implements OnModuleInit {
  private readonly logger = new Logger(HrLetterService.name);

  constructor(
    @InjectModel(HrLetterTemplate.name) private readonly templateModel: Model<HrLetterTemplateDocument>,
    @InjectModel(EmployeeHrLetter.name) private readonly letterModel: Model<EmployeeHrLetterDocument>,
    @InjectModel(HrLetterAuditLog.name) private readonly auditModel: Model<HrLetterAuditLogDocument>,
    @InjectModel(HrLetterCounter.name) private readonly counterModel: Model<HrLetterCounterDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(Setting.name) private readonly settingModel: Model<SettingDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    private readonly access: HrAccessService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultTemplates();
    await this.migrateIndexes();
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  async seedDefaultTemplates() {
    try {
      for (const def of DEFAULT_HR_LETTER_TEMPLATES) {
        const exists = await this.templateModel.exists({ letterType: def.letterType, isDefault: true });
        if (!exists) {
          await this.templateModel.create({ ...def, isDefault: true, status: 'active' });
          this.logger.log(`Seeded default template for HR Letter: ${def.letterType}`);
        }
      }
    } catch (err) {
      this.logger.error(`Error seeding default HR letter templates: ${(err as Error).message}`);
    }
  }

  // Older databases have a unique index on letterNumber alone, which made
  // every reissue (same number, next version) fail with a duplicate key.
  private async migrateIndexes() {
    try {
      const indexes = await this.letterModel.collection.indexes();
      const old = indexes.find((i: any) => i.unique && Object.keys(i.key || {}).join() === 'letterNumber');
      if (old?.name) {
        await this.letterModel.collection.dropIndex(old.name);
        this.logger.log(`Dropped legacy unique index ${old.name} on employee_hr_letters`);
      }
      await this.letterModel.createIndexes();
    } catch (err) {
      this.logger.error(`HR letter index migration failed: ${(err as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Memo numbers  (e.g. MGP/HR/APT/2026/0001)
  // ---------------------------------------------------------------------------

  private async scanMaxSeq(prefix: string, year: number) {
    const pattern = new RegExp(`^${escapeRegex(prefix)}/${year}/(\\d+)$`);
    const rows = await this.letterModel.find({ letterNumber: pattern }, { letterNumber: 1 }).lean();
    return rows.reduce((max, r) => Math.max(max, Number(r.letterNumber.match(pattern)?.[1]) || 0), 0);
  }

  private format(prefix: string, year: number, seq: number) {
    return `${prefix}/${year}/${String(seq).padStart(4, '0')}`;
  }

  async peekNextNumber(prefix: string, year: number) {
    const counter = await this.counterModel.findOne({ key: `${prefix}/${year}` }).lean();
    const current = counter ? counter.seq : await this.scanMaxSeq(prefix, year);
    return this.format(prefix, year, current + 1);
  }

  private async allocateNumber(prefix: string, year: number) {
    const key = `${prefix}/${year}`;
    if (!(await this.counterModel.exists({ key }))) {
      // First letter on this counter: continue after any numbers issued
      // before counters existed. $max keeps concurrent initialisers safe.
      const max = await this.scanMaxSeq(prefix, year);
      await this.counterModel.updateOne({ key }, { $max: { seq: max } }, { upsert: true }).catch(() => undefined);
    }
    const doc = await this.counterModel.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
    return this.format(prefix, year, doc!.seq);
  }

  async getNextLetterNumberPreview(letterType: string, letterDate?: string) {
    const template = await this.resolveTemplate(letterType);
    return this.peekNextNumber(template.memoPrefix, yearOf(letterDate));
  }

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  // Adds the effective `type` to every info field so clients can render the
  // right input (date picker, amount, long text) without guessing.
  private withFieldTypes<T extends { infoFields?: any[] }>(tpl: T): T {
    if (!tpl) return tpl;
    return { ...tpl, infoFields: (tpl.infoFields || []).map((f) => ({ ...f, type: fieldTypeOf(f) })) };
  }

  private async resolveTemplate(letterType: string, templateId?: string): Promise<any> {
    if (templateId && Types.ObjectId.isValid(templateId)) {
      const byId = await this.templateModel.findById(templateId).lean();
      if (byId) return byId;
    }
    const template =
      (await this.templateModel.findOne({ letterType, isDefault: true, status: 'active' }).lean()) ||
      (await this.templateModel.findOne({ letterType, status: 'active' }).lean()) ||
      (await this.templateModel.findOne({ letterType }).lean());
    if (!template) throw new NotFoundException(`No template found for letter type "${letterType}"`);
    return template;
  }

  async getTemplateForType(letterType: string) {
    return this.withFieldTypes(await this.resolveTemplate(letterType));
  }

  async getAllTemplates() {
    const list = await this.templateModel.find().sort({ letterType: 1, isDefault: -1 }).lean();
    return list.map((t) => this.withFieldTypes(t));
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto, actor: Actor, meta?: ReqMeta) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid template id');
    if (dto.infoFields) {
      const keys = dto.infoFields.map((f) => f.key);
      if (new Set(keys).size !== keys.length) throw new BadRequestException('Two information fields use the same key');
    }
    const template = await this.templateModel
      .findByIdAndUpdate(id, { $set: { ...dto, updatedBy: new Types.ObjectId(actor.id) } }, { new: true, runValidators: true })
      .lean();
    if (!template) throw new NotFoundException('Template not found');
    await this.logAction({ action: 'template_updated', performedBy: this.who(actor), metadata: { templateId: id, letterType: template.letterType, fields: Object.keys(dto) }, ...meta });
    return this.withFieldTypes(template);
  }

  // Restores a template's wording to the built-in default for its type.
  async resetTemplate(id: string, actor: Actor, meta?: ReqMeta) {
    const template = await this.templateModel.findById(id);
    if (!template) throw new NotFoundException('Template not found');
    const def = DEFAULT_HR_LETTER_TEMPLATES.find((d) => d.letterType === template.letterType);
    if (!def) throw new BadRequestException('No built-in default exists for this letter type');
    template.set({ ...def, defaultSignatories: FALLBACK_SIGNATORIES, updatedBy: new Types.ObjectId(actor.id) });
    await template.save();
    await this.logAction({ action: 'template_reset', performedBy: this.who(actor), metadata: { templateId: id, letterType: template.letterType }, ...meta });
    return this.withFieldTypes(template.toObject());
  }

  // Sample rendering of a template (optionally with unsaved edits) for the
  // template editor's preview.
  async previewTemplate(id: string, overrides?: UpdateTemplateDto) {
    const stored = await this.templateModel.findById(id).lean();
    if (!stored) throw new NotFoundException('Template not found');
    const template = { ...stored, ...(overrides || {}) };
    const sampleInput: Record<string, any> = {};
    for (const f of template.infoFields || []) {
      if (f.source === 'employee') continue;
      const type = fieldTypeOf(f);
      sampleInput[f.key] = f.defaultValue || (type === 'date' ? today() : type === 'money' ? '25000' : type === 'percent' ? '10' : `[${f.labelBangla}]`);
    }
    return this.buildContentSnapshot(template, SAMPLE_EMPLOYEE, {
      letterNumber: await this.peekNextNumber(template.memoPrefix, yearOf()),
      letterDate: today(),
      effectiveDate: today(),
      inputData: sampleInput,
    });
  }

  // ---------------------------------------------------------------------------
  // Snapshot rendering
  // ---------------------------------------------------------------------------

  /**
   * Builds the immutable rendered snapshot stored with a letter. Past letters
   * never change when employee, template or company details change later.
   */
  private async buildContentSnapshot(
    template: any,
    employee: any,
    opts: {
      letterNumber: string;
      letterDate: string;
      effectiveDate?: string;
      inputData?: Record<string, any>;
      customSignatories?: LetterSignatoriesDto;
    },
  ) {
    const settings: any = (await this.settingModel.findOne().lean()) || {};
    const currency = settings.currencySymbol || '৳';
    const inputData = opts.inputData || {};

    // Letterhead branch: the one chosen on the form, else the employee's
    // primary branch (for transfers this is the branch issuing the order).
    const branchName = pick(inputData.branch, employee.branches?.[0]) || '';
    let branchInfo: any = null;
    if (branchName) {
      const b = await this.branchModel.findOne({ name: branchName }).lean();
      if (b) branchInfo = { name: b.name, address: b.address, phone: b.phone, website: b.website };
    }

    // Info table: typed + formatted values.
    const formatted: Record<string, string> = {};
    const infoTable = (template.infoFields || []).map((field: any) => {
      const type = fieldTypeOf(field);
      let raw = inputData[field.key];
      if (raw === undefined || raw === null || raw === '') {
        if (field.source === 'employee' && field.employeeField) raw = employee[field.employeeField];
        if ((raw === undefined || raw === null || raw === '') && field.defaultValue) raw = field.defaultValue;
      }
      const value = formatFieldValue(type, raw, currency);
      formatted[field.key] = value;
      return { key: field.key, labelBangla: field.labelBangla, labelEnglish: field.labelEnglish, type, value: value || '—' };
    });

    const letterDateDisplay = formatBanglaDate(opts.letterDate) || opts.letterDate;
    const effectiveDate = opts.effectiveDate || inputData.effectiveDate || opts.letterDate;
    const effectiveDateDisplay = formatBanglaDate(effectiveDate) || effectiveDate;
    const designation = pick(inputData.newDesignation, inputData.designation, employee.jobPosition) || '';
    const department = pick(inputData.department, employee.department) || '';

    // Placeholders available to the subject and to every clause, e.g.
    // "{{employeeName}}", "{{newDesignation}}", "{{effectiveDate}}".
    const vars: Record<string, any> = {
      ...inputData,
      ...formatted,
      employeeName: employee.name,
      employeeId: employee.employeeId || '',
      employeeCode: employee.employeeId || '',
      designation,
      department,
      branch: branchName,
      letterNumber: opts.letterNumber,
      letterDate: letterDateDisplay,
      effectiveDate: effectiveDateDisplay,
      companyName: settings.companyName || 'Multi Gym Premium & Multi Gym',
    };

    const sections = (template.sections || []).map((s: any) => ({
      sectionNumber: s.sectionNumber,
      titleBangla: fillPlaceholders(s.titleBangla, vars),
      titleEnglish: s.titleEnglish,
      introText: fillPlaceholders(s.introText, vars),
      clauses: (s.clauses || []).map((c: string) => fillPlaceholders(c, vars)),
    }));

    const custom = opts.customSignatories || {};
    const defaults = template.defaultSignatories || {};
    const signatories = {
      issuedBy: {
        name: pick(custom.issuedBy?.name, defaults.issuedBy?.name, FALLBACK_SIGNATORIES.issuedBy.name),
        designation: pick(custom.issuedBy?.designation, defaults.issuedBy?.designation, FALLBACK_SIGNATORIES.issuedBy.designation),
        title: pick(custom.issuedBy?.title, defaults.issuedBy?.title, '') || '',
      },
      approvedBy: {
        name: pick(custom.approvedBy?.name, defaults.approvedBy?.name, FALLBACK_SIGNATORIES.approvedBy.name),
        designation: pick(custom.approvedBy?.designation, defaults.approvedBy?.designation, FALLBACK_SIGNATORIES.approvedBy.designation),
        company: pick(custom.approvedBy?.company, defaults.approvedBy?.company, FALLBACK_SIGNATORIES.approvedBy.company),
        onBehalfOf: pick(custom.approvedBy?.onBehalfOf, defaults.approvedBy?.onBehalfOf, FALLBACK_SIGNATORIES.approvedBy.onBehalfOf),
      },
      // An explicit (even empty) list from the form wins over the defaults.
      copyTo: (Array.isArray(custom.copyTo) ? custom.copyTo : defaults.copyTo?.length ? defaults.copyTo : FALLBACK_SIGNATORIES.copyTo)
        .map((c: string) => String(c || '').trim())
        .filter(Boolean),
    };

    return {
      company: {
        name: settings.companyName || 'MULTI GYM PREMIUM & MULTI GYM',
        tagline: settings.companyTagline || 'Multi Gym Premium | Multi Gym | Power FiT',
        brands: 'Multi Gym Premium  |  Multi Gym  |  Power FiT',
        logo: settings.logo || '',
        address: settings.address || '',
        phone: settings.phone || '',
        email: settings.email || '',
        website: settings.website || '',
      },
      branch: branchInfo,
      letterMeta: {
        letterType: template.letterType,
        letterNumber: opts.letterNumber,
        letterDate: opts.letterDate,
        letterDateDisplay,
        effectiveDate,
        effectiveDateDisplay,
        titleBangla: template.titleBangla,
        titleEnglish: template.titleEnglish,
        subject: fillPlaceholders(template.subjectTemplate, vars),
      },
      recipient: {
        employeeId: employee.employeeId,
        name: employee.name,
        fatherOrHusbandName: inputData.fatherOrHusbandName || '',
        designation,
        department,
        branch: branchName,
        joiningDate: formatBanglaDate(employee.joiningDate) || employee.joiningDate || '',
        phone: employee.mobileNumber,
        presentAddress: addressText(employee.presentAddress),
        permanentAddress: addressText(employee.permanentAddress),
        nidPassport: employee.nidPassport,
      },
      infoTable,
      sections,
      signatories,
      acknowledgementRequired: template.hasEmployeeAcknowledgment !== false,
    };
  }

  // ---------------------------------------------------------------------------
  // Letters
  // ---------------------------------------------------------------------------

  private who(actor: Actor): Who {
    return { id: Types.ObjectId.isValid(actor.id) ? new Types.ObjectId(actor.id) : actor.id, name: actor.name, role: actor.role };
  }

  private async loadEmployeeFor(actor: Actor, employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) throw new BadRequestException('Invalid employee');
    const employee: any = await this.employeeModel.findById(employeeId).select('-password').lean();
    if (!employee) throw new NotFoundException('Employee not found');
    this.access.assertCanAccess(actor, String(employee._id), employee.branches);
    return employee;
  }

  private async loadLetterFor(actor: Actor, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid letter id');
    const letter = await this.letterModel.findById(id);
    if (!letter) throw new NotFoundException('HR letter not found');
    this.access.assertCanAccess(actor, String(letter.employeeId), letter.branch);
    return letter;
  }

  private baseInput(dto: { inputData?: any; branch?: string; department?: string; designation?: string }, employee: any, prev: any = {}) {
    return {
      ...prev,
      ...(dto.inputData || {}),
      branch: pick(dto.branch, dto.inputData?.branch, prev.branch, employee.branches?.[0]) || '',
      department: pick(dto.department, dto.inputData?.department, prev.department, employee.department) || '',
      designation: pick(dto.designation, dto.inputData?.designation, prev.designation, employee.jobPosition) || '',
    };
  }

  private fileNameFor(employee: any, letterType: string, letterNumber: string, version = 1) {
    return `${employee.employeeId || 'EMP'}_${letterType}_${letterNumber.replace(/[/]/g, '-')}${version > 1 ? `_v${version}` : ''}.pdf`;
  }

  private draftNumber(prefix: string) {
    return `DRAFT-${prefix.replace(/[/]/g, '-')}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  async previewLetter(dto: PreviewLetterDto, actor: Actor) {
    const employee = await this.loadEmployeeFor(actor, dto.employeeId);
    const template = await this.resolveTemplate(dto.letterType, dto.templateId);
    const letterDate = dto.letterDate || today();
    let letterNumber = await this.peekNextNumber(template.memoPrefix, yearOf(letterDate));
    if (dto.draftId && Types.ObjectId.isValid(dto.draftId)) {
      const draft = await this.letterModel.findById(dto.draftId, { letterNumber: 1, status: 1 }).lean();
      if (draft && draft.status !== 'draft') letterNumber = draft.letterNumber;
    }
    const snapshot = await this.buildContentSnapshot(template, employee, {
      letterNumber,
      letterDate,
      effectiveDate: dto.effectiveDate,
      inputData: this.baseInput(dto, employee),
      customSignatories: dto.customSignatories,
    });
    return { snapshot, nextLetterNumber: letterNumber };
  }

  async createLetter(dto: CreateLetterDto, actor: Actor, meta?: ReqMeta) {
    const employee = await this.loadEmployeeFor(actor, dto.employeeId);
    const template = await this.resolveTemplate(dto.letterType, dto.templateId);
    const isDraft = dto.status === 'draft';
    const inputData = this.baseInput(dto, employee);

    // A unique-index clash can only come from a manual data edit; retry once
    // with a fresh number rather than failing the user.
    for (let attempt = 0; attempt < 2; attempt++) {
      const letterNumber = isDraft ? this.draftNumber(template.memoPrefix) : await this.allocateNumber(template.memoPrefix, yearOf(dto.letterDate));
      const contentSnapshot = await this.buildContentSnapshot(template, employee, {
        letterNumber,
        letterDate: dto.letterDate,
        effectiveDate: dto.effectiveDate,
        inputData,
        customSignatories: dto.customSignatories,
      });
      try {
        const letter = await this.letterModel.create({
          employeeId: employee._id,
          employeeCode: employee.employeeId,
          employeeName: employee.name,
          employeePhoto: employee.photo,
          letterType: template.letterType,
          letterNumber,
          letterDate: dto.letterDate,
          effectiveDate: dto.effectiveDate || dto.letterDate,
          templateId: template._id,
          branch: inputData.branch,
          department: inputData.department,
          designation: inputData.designation,
          status: isDraft ? 'draft' : 'generated',
          version: 1,
          inputData,
          contentSnapshot,
          fileName: this.fileNameFor(employee, template.letterType, letterNumber),
          remarks: dto.remarks || '',
          generatedBy: this.who(actor),
          generatedAt: new Date(),
          issuedAt: isDraft ? null : new Date(),
        });
        await this.logAction({
          letterId: letter._id,
          letterNumber,
          employeeId: employee._id,
          employeeName: employee.name,
          action: isDraft ? 'created' : 'generated',
          performedBy: this.who(actor),
          metadata: { letterType: template.letterType, status: letter.status },
          ...meta,
        });
        return letter;
      } catch (err: any) {
        if (err?.code !== 11000 || attempt === 1) throw err;
      }
    }
    throw new BadRequestException('Could not allocate a letter number, please try again');
  }

  async updateDraft(id: string, dto: UpdateDraftDto, actor: Actor, meta?: ReqMeta) {
    const letter = await this.loadLetterFor(actor, id);
    if (letter.status !== 'draft') throw new BadRequestException('Only drafts can be edited. Use "Reissue" to change an issued letter.');
    const employee = await this.loadEmployeeFor(actor, String(letter.employeeId));
    const template = await this.resolveTemplate(letter.letterType, dto.templateId || String(letter.templateId || ''));
    const inputData = this.baseInput(dto, employee, letter.inputData || {});
    const letterDate = dto.letterDate || letter.letterDate;
    const effectiveDate = dto.effectiveDate || letter.effectiveDate;

    letter.set({
      letterDate,
      effectiveDate,
      branch: inputData.branch,
      department: inputData.department,
      designation: inputData.designation,
      inputData,
      remarks: dto.remarks ?? letter.remarks,
      contentSnapshot: await this.buildContentSnapshot(template, employee, {
        letterNumber: letter.letterNumber,
        letterDate,
        effectiveDate,
        inputData,
        customSignatories: dto.customSignatories || letter.contentSnapshot?.signatories,
      }),
      updatedBy: this.who(actor),
    });
    letter.markModified('inputData');
    letter.markModified('contentSnapshot');
    await letter.save();
    await this.logAction({ letterId: letter._id, letterNumber: letter.letterNumber, employeeId: letter.employeeId, employeeName: letter.employeeName, action: 'updated', performedBy: this.who(actor), ...meta });
    return letter;
  }

  // Turns a draft into an official letter with the next memo number.
  async issueDraft(id: string, actor: Actor, meta?: ReqMeta) {
    const draft = await this.loadLetterFor(actor, id);
    if (draft.status !== 'draft') throw new BadRequestException('This letter has already been issued');
    const employee = await this.loadEmployeeFor(actor, String(draft.employeeId));
    const template = await this.resolveTemplate(draft.letterType, String(draft.templateId || ''));
    const letterNumber = await this.allocateNumber(template.memoPrefix, yearOf(draft.letterDate));
    const contentSnapshot = await this.buildContentSnapshot(template, employee, {
      letterNumber,
      letterDate: draft.letterDate,
      effectiveDate: draft.effectiveDate,
      inputData: draft.inputData,
      customSignatories: draft.contentSnapshot?.signatories,
    });
    // Conditional update: a double click issues once; the second call
    // finds the letter no longer a draft.
    const issued = await this.letterModel.findOneAndUpdate(
      { _id: draft._id, status: 'draft' },
      {
        $set: {
          status: 'generated',
          letterNumber,
          contentSnapshot,
          fileName: this.fileNameFor(employee, draft.letterType, letterNumber),
          issuedAt: new Date(),
          updatedBy: this.who(actor),
        },
      },
      { new: true },
    );
    if (!issued) throw new BadRequestException('This letter has already been issued');
    await this.logAction({ letterId: issued._id, letterNumber, employeeId: issued.employeeId, employeeName: issued.employeeName, action: 'issued', performedBy: this.who(actor), metadata: { draftNumber: draft.letterNumber }, ...meta });
    return issued;
  }

  /**
   * Reissue (version control): keeps the original as "superseded" and
   * creates version N+1 with the same memo number.
   */
  async reissueLetter(id: string, dto: ReissueLetterDto, actor: Actor, meta?: ReqMeta) {
    const existing = await this.loadLetterFor(actor, id);
    if (existing.status === 'draft') throw new BadRequestException('Drafts are edited directly — reissue applies to issued letters');
    if (existing.status === 'cancelled') throw new BadRequestException('A cancelled letter cannot be reissued');
    if (existing.status === 'reissued') throw new BadRequestException('A newer version of this letter exists. Open the latest version to reissue it.');

    const employee = await this.loadEmployeeFor(actor, String(existing.employeeId));
    const template = await this.resolveTemplate(existing.letterType, String(existing.templateId || ''));
    const nextVersion = (existing.version || 1) + 1;
    const letterDate = dto.letterDate || existing.letterDate;
    const effectiveDate = dto.effectiveDate || existing.effectiveDate;
    const inputData = this.baseInput({ inputData: dto.inputData }, employee, existing.inputData || {});

    const reissued = await this.letterModel.create({
      employeeId: employee._id,
      employeeCode: employee.employeeId,
      employeeName: employee.name,
      employeePhoto: employee.photo,
      letterType: existing.letterType,
      letterNumber: existing.letterNumber,
      letterDate,
      effectiveDate,
      templateId: template._id,
      branch: inputData.branch,
      department: inputData.department,
      designation: inputData.designation,
      status: 'generated',
      version: nextVersion,
      parentLetterId: existing._id,
      inputData,
      contentSnapshot: await this.buildContentSnapshot(template, employee, {
        letterNumber: existing.letterNumber,
        letterDate,
        effectiveDate,
        inputData,
        customSignatories: dto.customSignatories || existing.contentSnapshot?.signatories,
      }),
      fileName: this.fileNameFor(employee, existing.letterType, existing.letterNumber, nextVersion),
      remarks: dto.remarks || existing.remarks,
      reissueReason: dto.reissueReason,
      generatedBy: this.who(actor),
      generatedAt: new Date(),
      issuedAt: new Date(),
    });

    // Only mark the old version superseded once the new one exists.
    existing.status = 'reissued';
    await existing.save();

    await this.logAction({
      letterId: reissued._id,
      letterNumber: reissued.letterNumber,
      employeeId: employee._id,
      employeeName: employee.name,
      action: 'reissued',
      performedBy: this.who(actor),
      metadata: { previousLetterId: existing._id, version: nextVersion, reissueReason: dto.reissueReason },
      ...meta,
    });
    return reissued;
  }

  async cancelLetter(id: string, reason: string, actor: Actor, meta?: ReqMeta) {
    const letter = await this.loadLetterFor(actor, id);
    if (!ISSUED_STATUSES.includes(letter.status)) {
      throw new BadRequestException(letter.status === 'draft' ? 'Drafts can simply be deleted' : 'Only the current issued version can be cancelled');
    }
    letter.set({ status: 'cancelled', cancelledAt: new Date(), cancelReason: reason, cancelledBy: this.who(actor) });
    await letter.save();
    await this.logAction({ letterId: letter._id, letterNumber: letter.letterNumber, employeeId: letter.employeeId, employeeName: letter.employeeName, action: 'cancelled', performedBy: this.who(actor), metadata: { reason }, ...meta });
    return letter;
  }

  // Drafts can be deleted by anyone with delete permission; issued letters
  // are official records — only a super admin may hard-delete them.
  async deleteLetter(id: string, actor: Actor, meta?: ReqMeta) {
    const letter = await this.loadLetterFor(actor, id);
    if (letter.status !== 'draft' && !actor.isSuperAdmin) {
      throw new ForbiddenException('Issued letters cannot be deleted. Cancel the letter instead so its record is kept.');
    }
    await this.logAction({
      letterId: letter._id,
      letterNumber: letter.letterNumber,
      employeeId: letter.employeeId,
      employeeName: letter.employeeName,
      action: 'deleted',
      performedBy: this.who(actor),
      metadata: { letterType: letter.letterType, status: letter.status, version: letter.version },
      ...meta,
    });
    await letter.deleteOne();
    return { success: true, message: letter.status === 'draft' ? 'Draft deleted' : 'Letter deleted' };
  }

  async getLetterById(id: string, actor: Actor) {
    const doc = await this.loadLetterFor(actor, id);
    const letter = doc.toObject();
    const [versions, auditLogs] = await Promise.all([
      letter.status === 'draft'
        ? Promise.resolve([])
        : this.letterModel
            .find({ letterNumber: letter.letterNumber }, { version: 1, status: 1, letterDate: 1, generatedBy: 1, reissueReason: 1, createdAt: 1 })
            .sort({ version: 1 })
            .lean(),
      this.auditModel
        .find({ $or: [{ letterId: letter._id }, { letterNumber: letter.letterNumber }] }, { userAgent: 0 })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);
    return { letter, versions, auditLogs };
  }

  private scopeMatch(actor: Actor): Record<string, any> {
    if (actor.scope === 'self') return { employeeId: new Types.ObjectId(actor.id) };
    if (actor.scope === 'branch') return { branch: { $in: actor.branches } };
    return {};
  }

  async queryLetters(query: QueryLetterDto, actor: Actor) {
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit || '10', 10) || 10));
    const filter: any = { ...this.scopeMatch(actor) };

    if (query.search) {
      // Already regex-escaped by the global sanitizeRequest middleware.
      const re = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ employeeName: re }, { employeeCode: re }, { letterNumber: re }, { 'contentSnapshot.letterMeta.subject': re }];
    }
    if (query.letterType && query.letterType !== 'all') filter.letterType = query.letterType;
    const branches = this.access.resolveBranchFilter(actor, query.branch);
    if (branches) filter.branch = { $in: branches };
    if (query.department && query.department !== 'all') filter.department = query.department;
    if (query.employeeId && Types.ObjectId.isValid(query.employeeId)) filter.employeeId = new Types.ObjectId(query.employeeId);

    // Superseded versions are hidden unless asked for; "issued" covers both
    // stored spellings of an official letter.
    const status = query.status || 'all';
    if (status === 'issued' || status === 'generated') filter.status = { $in: ISSUED_STATUSES };
    else if (status === 'all_versions') {
      /* everything */
    } else if (status !== 'all') filter.status = status;
    else filter.status = { $ne: 'reissued' };

    if (query.startDate || query.endDate) {
      filter.letterDate = {};
      if (query.startDate) filter.letterDate.$gte = query.startDate;
      if (query.endDate) filter.letterDate.$lte = query.endDate;
    }

    const sortField = SORTABLE.has(query.sortBy || '') ? (query.sortBy as string) : 'createdAt';
    const sort: any = { [sortField]: query.sortOrder === 'asc' ? 1 : -1, _id: -1 };

    const [items, totalItems] = await Promise.all([
      this.letterModel.find(filter, LIST_FIELDS).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      this.letterModel.countDocuments(filter),
    ]);
    return {
      items,
      pagination: { currentPage: page, itemsPerPage: limit, totalItems, totalPages: Math.ceil(totalItems / limit) || 1 },
    };
  }

  async getEmployeeLetters(employeeId: string, actor: Actor) {
    const employee = await this.loadEmployeeFor(actor, employeeId);
    return this.letterModel
      .find({ employeeId: employee._id, status: { $ne: 'reissued' } }, LIST_FIELDS)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  }

  async getStats(actor: Actor) {
    const scope = this.scopeMatch(actor);
    const month = today().slice(0, 7);
    const [issued, drafts, cancelled, thisMonth, byType] = await Promise.all([
      this.letterModel.countDocuments({ ...scope, status: { $in: ISSUED_STATUSES } }),
      this.letterModel.countDocuments({ ...scope, status: 'draft' }),
      this.letterModel.countDocuments({ ...scope, status: 'cancelled' }),
      this.letterModel.countDocuments({ ...scope, status: { $in: ISSUED_STATUSES }, letterDate: { $regex: `^${month}` } }),
      this.letterModel.aggregate([{ $match: { ...scope, status: { $in: ISSUED_STATUSES } } }, { $group: { _id: '$letterType', count: { $sum: 1 } } }]),
    ]);
    return {
      totalLetters: issued + drafts + cancelled,
      issuedLetters: issued,
      activeDrafts: drafts,
      cancelledLetters: cancelled,
      thisMonthCount: thisMonth,
      byType: byType.reduce((acc: any, cur: any) => ({ ...acc, [cur._id]: cur.count }), {}),
    };
  }

  // ---------------------------------------------------------------------------
  // Employee self-service
  // ---------------------------------------------------------------------------

  private myFilter(actor: Actor) {
    if (!Types.ObjectId.isValid(actor.id)) throw new ForbiddenException('Not authenticated');
    return { employeeId: new Types.ObjectId(actor.id), status: { $in: MY_STATUSES } };
  }

  async getMyLetters(actor: Actor) {
    return this.letterModel.find(this.myFilter(actor), MY_LIST_FIELDS).sort({ letterDate: -1, createdAt: -1 }).limit(200).lean();
  }

  async getMyLetter(id: string, actor: Actor) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid letter id');
    const letter = await this.letterModel.findOne({ _id: new Types.ObjectId(id), ...this.myFilter(actor) }, MY_HIDDEN_FIELDS).lean();
    if (!letter) throw new NotFoundException('Letter not found');
    return letter;
  }

  async logMyAction(id: string, action: string, actor: Actor, meta?: ReqMeta) {
    const letter = await this.getMyLetter(id, actor);
    await this.logAction({ letterId: letter._id, letterNumber: letter.letterNumber, employeeId: letter.employeeId, employeeName: letter.employeeName, action, performedBy: this.who(actor), metadata: { selfService: true }, ...meta });
  }

  // ---------------------------------------------------------------------------
  // Audit trail
  // ---------------------------------------------------------------------------

  async logAction(data: {
    letterId?: Types.ObjectId;
    letterNumber?: string;
    employeeId?: Types.ObjectId;
    employeeName?: string;
    action: string;
    performedBy: Who;
    metadata?: Record<string, any>;
    ip?: string;
    userAgent?: string;
  }) {
    try {
      await this.auditModel.create({
        letterId: data.letterId,
        letterNumber: data.letterNumber,
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        action: data.action,
        performedBy: data.performedBy,
        metadata: data.metadata || {},
        ipAddress: data.ip || '',
        userAgent: data.userAgent || '',
      });
    } catch (err) {
      this.logger.error(`Failed to create audit log: ${(err as Error).message}`);
    }
  }

  async logClientAction(id: string, action: string, actor: Actor, meta?: ReqMeta) {
    const letter = await this.loadLetterFor(actor, id);
    await this.logAction({ letterId: letter._id, letterNumber: letter.letterNumber, employeeId: letter.employeeId, employeeName: letter.employeeName, action, performedBy: this.who(actor), ...meta });
  }

  async getAuditLogs(
    opts: { page?: number; limit?: number; search?: string; action?: string; startDate?: string; endDate?: string },
    actor: Actor,
  ) {
    const page = Math.max(1, opts.page || 1);
    const limit = Math.max(1, Math.min(100, opts.limit || 20));
    const filter: any = {};
    if (actor.scope === 'self') filter.employeeId = new Types.ObjectId(actor.id);
    else if (actor.scope === 'branch') {
      const ids = await this.employeeModel.find({ branches: { $in: actor.branches } }, { _id: 1 }).lean();
      filter.employeeId = { $in: ids.map((e) => e._id) };
    }
    if (opts.search) {
      const re = new RegExp(opts.search.trim(), 'i');
      filter.$or = [{ letterNumber: re }, { employeeName: re }, { action: re }, { 'performedBy.name': re }];
    }
    if (opts.action && opts.action !== 'all') filter.action = opts.action;
    if (opts.startDate || opts.endDate) {
      filter.createdAt = {};
      if (opts.startDate) filter.createdAt.$gte = new Date(`${opts.startDate}T00:00:00+06:00`);
      if (opts.endDate) filter.createdAt.$lte = new Date(`${opts.endDate}T23:59:59.999+06:00`);
    }
    const [items, total] = await Promise.all([
      this.auditModel.find(filter, { userAgent: 0 }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.auditModel.countDocuments(filter),
    ]);
    return {
      items,
      pagination: { currentPage: page, itemsPerPage: limit, totalItems: total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}
