import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  HrLetterTemplate,
  HrLetterTemplateDocument,
  HR_LETTER_TYPES,
} from './schemas/hr-letter-template.schema';
import {
  EmployeeHrLetter,
  EmployeeHrLetterDocument,
} from './schemas/employee-hr-letter.schema';
import {
  HrLetterAuditLog,
  HrLetterAuditLogDocument,
} from './schemas/hr-letter-audit-log.schema';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { Setting, SettingDocument } from '../setting/schemas/setting.schema';
import { Branch, BranchDocument } from '../branch/schemas/branch.schema';
import { DEFAULT_HR_LETTER_TEMPLATES } from './default-templates.data';
import { CreateLetterDto } from './dto/create-letter.dto';
import { ReissueLetterDto } from './dto/reissue-letter.dto';
import { QueryLetterDto } from './dto/query-letter.dto';

@Injectable()
export class HrLetterService implements OnModuleInit {
  private readonly logger = new Logger(HrLetterService.name);

  constructor(
    @InjectModel(HrLetterTemplate.name)
    private readonly templateModel: Model<HrLetterTemplateDocument>,
    @InjectModel(EmployeeHrLetter.name)
    private readonly letterModel: Model<EmployeeHrLetterDocument>,
    @InjectModel(HrLetterAuditLog.name)
    private readonly auditModel: Model<HrLetterAuditLogDocument>,
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(Setting.name)
    private readonly settingModel: Model<SettingDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultTemplates();
  }

  /**
   * Seed standard 13 templates extracted from Master docx files if not present.
   */
  async seedDefaultTemplates() {
    try {
      for (const def of DEFAULT_HR_LETTER_TEMPLATES) {
        const exists = await this.templateModel.findOne({
          letterType: def.letterType,
          isDefault: true,
        });
        if (!exists) {
          await this.templateModel.create({
            letterType: def.letterType,
            name: def.name,
            titleBangla: def.titleBangla,
            titleEnglish: def.titleEnglish,
            memoPrefix: def.memoPrefix,
            subjectTemplate: def.subjectTemplate,
            infoFields: def.infoFields,
            sections: def.sections,
            hasEmployeeAcknowledgment: def.hasEmployeeAcknowledgment,
            isDefault: true,
            status: 'active',
          });
          this.logger.log(`Seeded default template for HR Letter: ${def.letterType}`);
        }
      }
    } catch (err) {
      this.logger.error(`Error seeding default HR letter templates: ${(err as Error).message}`);
    }
  }

  /**
   * Generates the next unique letter memo number:
   * e.g. MGP/HR/APT/2026/0001
   */
  async generateNextLetterNumber(prefix: string, year: number): Promise<string> {
    const pattern = new RegExp(`^${prefix}/${year}/(\\d+)$`);
    const letters = await this.letterModel
      .find({ letterNumber: pattern }, { letterNumber: 1 })
      .lean();

    let maxSeq = 0;
    for (const item of letters) {
      const match = item.letterNumber.match(pattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }

    const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
    return `${prefix}/${year}/${nextSeq}`;
  }

  /**
   * Preview what the next letter number will be for a given letter type
   */
  async getNextLetterNumberPreview(letterType: string): Promise<string> {
    const template = await this.getTemplateForType(letterType);
    const prefix = template?.memoPrefix || `MGP/HR/${letterType.toUpperCase().slice(0, 4)}`;
    const year = new Date().getFullYear();
    return this.generateNextLetterNumber(prefix, year);
  }

  /**
   * Get active default template for a letter type
   */
  async getTemplateForType(letterType: string): Promise<HrLetterTemplateDocument> {
    let template = await this.templateModel.findOne({ letterType, isDefault: true, status: 'active' });
    if (!template) {
      template = await this.templateModel.findOne({ letterType, status: 'active' });
    }
    if (!template) {
      template = await this.templateModel.findOne({ letterType });
    }
    if (!template) {
      throw new NotFoundException(`No template found for letter type "${letterType}"`);
    }
    return template;
  }

  /**
   * List all templates
   */
  async getAllTemplates(): Promise<HrLetterTemplateDocument[]> {
    return this.templateModel.find().sort({ letterType: 1, isDefault: -1 }).lean();
  }

  /**
   * Update template
   */
  async updateTemplate(id: string, updates: Partial<HrLetterTemplate>, user: any): Promise<HrLetterTemplateDocument> {
    const template = await this.templateModel.findByIdAndUpdate(
      id,
      { ...updates, updatedBy: user?.userId || user?._id },
      { new: true },
    );
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  /**
   * Build immutable rendered snapshot for official letter
   */
  private async buildContentSnapshot(
    template: HrLetterTemplateDocument,
    employee: EmployeeDocument,
    letterNumber: string,
    letterDate: string,
    inputData: Record<string, any> = {},
    customSignatories?: any,
  ) {
    const settings = (await this.settingModel.findOne().lean()) || ({} as any);

    // Primary branch
    const branchName = inputData.branch || (employee.branches && employee.branches[0]) || '';
    let branchInfo: any = null;
    if (branchName) {
      const bDoc = await this.branchModel.findOne({ name: branchName }).lean();
      if (bDoc) {
        branchInfo = {
          name: bDoc.name,
          address: bDoc.address,
          phone: bDoc.phone,
          website: bDoc.website,
        };
      }
    }

    // Replace subject variables
    let subject = template.subjectTemplate;
    const allVariables: Record<string, any> = {
      employeeName: employee.name,
      employeeId: employee.employeeId || 'EMP',
      designation: inputData.newDesignation || inputData.designation || employee.jobPosition || '',
      department: inputData.department || employee.department || '',
      branch: branchName,
      effectiveDate: inputData.effectiveDate || letterDate,
      letterDate,
      letterNumber,
      companyName: settings.companyName || 'Multi Gym Premium & Multi Gym',
      ...inputData,
    };

    for (const [key, val] of Object.entries(allVariables)) {
      if (typeof val === 'string' || typeof val === 'number') {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        subject = subject.replace(regex, String(val));
      }
    }

    // Build info table key-values
    const infoTable: Array<{ key: string; labelBangla: string; labelEnglish?: string; value: string }> = [];
    for (const field of template.infoFields) {
      let value = '';
      if (inputData[field.key] !== undefined && inputData[field.key] !== null && inputData[field.key] !== '') {
        value = String(inputData[field.key]);
      } else if (field.source === 'employee' && field.employeeField) {
        const empVal = (employee as any)[field.employeeField];
        if (Array.isArray(empVal)) {
          value = empVal.join(', ');
        } else if (empVal) {
          value = String(empVal);
        }
      } else if (field.defaultValue) {
        value = field.defaultValue;
      }

      infoTable.push({
        key: field.key,
        labelBangla: field.labelBangla,
        labelEnglish: field.labelEnglish,
        value: value || '—',
      });
    }

    // Signatories
    const signatories = {
      issuedBy: {
        name: customSignatories?.issuedBy?.name || template.defaultSignatories?.issuedBy?.name || 'মোঃ ফয়জুর রহমান মানিক',
        designation: customSignatories?.issuedBy?.designation || template.defaultSignatories?.issuedBy?.designation || 'Manager: Admin & HR',
        title: customSignatories?.issuedBy?.title || template.defaultSignatories?.issuedBy?.title || 'Senior Trainer',
      },
      approvedBy: {
        name: customSignatories?.approvedBy?.name || template.defaultSignatories?.approvedBy?.name || 'কর্নেল মোঃ বনী ইয়ামীন (অবঃ)',
        designation: customSignatories?.approvedBy?.designation || template.defaultSignatories?.approvedBy?.designation || 'পরিচালক',
        company: customSignatories?.approvedBy?.company || template.defaultSignatories?.approvedBy?.company || 'মাল্টি জিম প্রিমিয়াম ও মাল্টি জিম',
        onBehalfOf: customSignatories?.approvedBy?.onBehalfOf || template.defaultSignatories?.approvedBy?.onBehalfOf || 'পক্ষে, ব্যবস্থাপনা পরিচালক',
      },
      copyTo: customSignatories?.copyTo || template.defaultSignatories?.copyTo || [
        'ব্যবস্থাপনা পরিচালক, মাল্টি জিম প্রিমিয়াম ও মাল্টি জিম',
        'পরিচালক, মাল্টি জিম প্রিমিয়াম ও মাল্টি জিম',
        'ম্যানেজার এডমিন',
        'ম্যানেজার একাউন্টস',
      ],
    };

    return {
      company: {
        name: settings.companyName || 'MULTI GYM PREMIUM & MULTI GYM',
        tagline: settings.companyTagline || 'Multi Gym Premium | Multi Gym | Power FiT',
        brands: 'Multi Gym Premium  |  Multi Gym  |  Power FiT',
        logo: settings.logo || '',
        address: settings.address || 'Dhaka, Bangladesh',
        phone: settings.phone || '+880 1700-000000',
        email: settings.email || 'info@multigympremium.com',
        website: settings.website || 'https://multigymhr.com',
      },
      branch: branchInfo,
      letterMeta: {
        letterType: template.letterType,
        letterNumber,
        letterDate,
        titleBangla: template.titleBangla,
        titleEnglish: template.titleEnglish,
        subject,
      },
      recipient: {
        employeeId: employee.employeeId,
        name: employee.name,
        fatherOrHusbandName: inputData.fatherOrHusbandName || '',
        designation: inputData.newDesignation || inputData.designation || employee.jobPosition,
        department: inputData.department || employee.department,
        branch: branchName,
        joiningDate: employee.joiningDate,
        phone: employee.mobileNumber,
        presentAddress: typeof employee.presentAddress === 'object'
          ? [employee.presentAddress?.addressLine1, employee.presentAddress?.area, employee.presentAddress?.city].filter(Boolean).join(', ')
          : employee.presentAddress,
        permanentAddress: typeof employee.permanentAddress === 'object'
          ? [employee.permanentAddress?.addressLine1, employee.permanentAddress?.area, employee.permanentAddress?.city].filter(Boolean).join(', ')
          : employee.permanentAddress,
        nidPassport: employee.nidPassport,
        emergencyContact: employee.emergencyContact?.name
          ? `${employee.emergencyContact.name} (${employee.emergencyContact.relation || 'Contact'} - ${employee.emergencyContact.mobileNumber || ''})`
          : '',
      },
      infoTable,
      sections: template.sections || [],
      signatories,
      acknowledgementRequired: template.hasEmployeeAcknowledgment,
    };
  }

  /**
   * Create Letter (Draft or Official Generated)
   */
  async createLetter(dto: CreateLetterDto, user: any, reqMeta?: { ip?: string; userAgent?: string }) {
    const employee = await this.employeeModel.findById(dto.employeeId);
    if (!employee) {
      throw new NotFoundException(`Employee with ID "${dto.employeeId}" not found`);
    }

    const template = dto.templateId
      ? await this.templateModel.findById(dto.templateId)
      : await this.getTemplateForType(dto.letterType);

    if (!template) {
      throw new NotFoundException(`Template for letter type "${dto.letterType}" not found`);
    }

    const year = new Date(dto.letterDate || Date.now()).getFullYear() || new Date().getFullYear();
    const isDraft = dto.status === 'draft';

    let letterNumber: string;
    if (isDraft) {
      letterNumber = `DRAFT-${template.memoPrefix.replace(/[/]/g, '-')}-${Date.now().toString().slice(-6)}`;
    } else {
      letterNumber = await this.generateNextLetterNumber(template.memoPrefix, year);
    }

    const inputData = {
      ...(dto.inputData || {}),
      branch: dto.branch || (employee.branches && employee.branches[0]) || '',
      department: dto.department || employee.department || '',
      designation: dto.designation || employee.jobPosition || '',
    };

    const contentSnapshot = await this.buildContentSnapshot(
      template,
      employee,
      letterNumber,
      dto.letterDate,
      inputData,
      dto.customSignatories,
    );

    const fileName = `${employee.employeeId || 'EMP'}_${template.letterType}_${letterNumber.replace(/[/]/g, '-')}.pdf`;

    const newLetter = await this.letterModel.create({
      employeeId: employee._id,
      employeeCode: employee.employeeId,
      employeeName: employee.name,
      employeePhoto: employee.photo,
      letterType: dto.letterType,
      letterNumber,
      letterDate: dto.letterDate,
      effectiveDate: dto.effectiveDate || dto.letterDate,
      templateId: template._id,
      branch: inputData.branch,
      department: inputData.department,
      designation: inputData.designation,
      status: dto.status || 'generated',
      version: 1,
      inputData,
      contentSnapshot,
      fileName,
      remarks: dto.remarks || '',
      generatedBy: {
        id: user?.userId || user?._id,
        name: user?.name || user?.employeeName || 'Authorized HR',
        role: user?.role || 'admin',
      },
      generatedAt: new Date(),
    });

    // Audit Log
    await this.logAction({
      letterId: newLetter._id,
      letterNumber: newLetter.letterNumber,
      employeeId: employee._id,
      employeeName: employee.name,
      action: isDraft ? 'created' : 'generated',
      performedBy: {
        id: user?.userId || user?._id,
        name: user?.name || user?.employeeName || 'Authorized HR',
        role: user?.role || 'admin',
      },
      metadata: { letterType: dto.letterType, status: newLetter.status },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.userAgent,
    });

    return newLetter;
  }

  /**
   * Reissue Letter (Version Control)
   * Preserves historical letter and creates Version N+1
   */
  async reissueLetter(id: string, dto: ReissueLetterDto, user: any, reqMeta?: { ip?: string; userAgent?: string }) {
    const existing = await this.letterModel.findById(id);
    if (!existing) throw new NotFoundException('Original letter not found');

    const employee = await this.employeeModel.findById(existing.employeeId);
    if (!employee) throw new NotFoundException('Employee not found');

    const template = existing.templateId
      ? await this.templateModel.findById(existing.templateId)
      : await this.getTemplateForType(existing.letterType);

    if (!template) throw new NotFoundException('Template not found');

    const nextVersion = (existing.version || 1) + 1;
    const letterDate = dto.letterDate || existing.letterDate;
    const inputData = { ...existing.inputData, ...(dto.inputData || {}) };

    const contentSnapshot = await this.buildContentSnapshot(
      template,
      employee,
      existing.letterNumber,
      letterDate,
      inputData,
      dto.customSignatories,
    );

    // Mark existing as superseded / reissued
    existing.status = 'reissued';
    await existing.save();

    const fileName = `${employee.employeeId || 'EMP'}_${existing.letterType}_${existing.letterNumber.replace(/[/]/g, '-')}_v${nextVersion}.pdf`;

    const reissuedLetter = await this.letterModel.create({
      employeeId: employee._id,
      employeeCode: employee.employeeId,
      employeeName: employee.name,
      employeePhoto: employee.photo,
      letterType: existing.letterType,
      letterNumber: existing.letterNumber,
      letterDate,
      effectiveDate: dto.effectiveDate || existing.effectiveDate,
      templateId: template._id,
      branch: inputData.branch || existing.branch,
      department: inputData.department || existing.department,
      designation: inputData.designation || existing.designation,
      status: 'generated',
      version: nextVersion,
      parentLetterId: existing._id,
      inputData,
      contentSnapshot,
      fileName,
      remarks: dto.remarks || existing.remarks,
      reissueReason: dto.reissueReason,
      generatedBy: {
        id: user?.userId || user?._id,
        name: user?.name || user?.employeeName || 'Authorized HR',
        role: user?.role || 'admin',
      },
      generatedAt: new Date(),
    });

    await this.logAction({
      letterId: reissuedLetter._id,
      letterNumber: reissuedLetter.letterNumber,
      employeeId: employee._id,
      employeeName: employee.name,
      action: 'reissued',
      performedBy: {
        id: user?.userId || user?._id,
        name: user?.name || user?.employeeName || 'Authorized HR',
        role: user?.role || 'admin',
      },
      metadata: {
        previousLetterId: existing._id,
        version: nextVersion,
        reissueReason: dto.reissueReason,
      },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.userAgent,
    });

    return reissuedLetter;
  }

  /**
   * Get single letter by ID, including its version history and audit log
   */
  async getLetterById(id: string) {
    const letter = await this.letterModel.findById(id).lean();
    if (!letter) throw new NotFoundException('HR letter not found');

    // Find all versions of this letter number
    const versions = await this.letterModel
      .find({ letterNumber: letter.letterNumber })
      .sort({ version: 1 })
      .lean();

    // Find audit logs
    const auditLogs = await this.auditModel
      .find({
        $or: [{ letterId: letter._id }, { letterNumber: letter.letterNumber }],
      })
      .sort({ createdAt: -1 })
      .lean();

    return {
      letter,
      versions,
      auditLogs,
    };
  }

  /**
   * Query letters list with search and filters
   */
  async queryLetters(query: QueryLetterDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { employeeName: searchRegex },
        { employeeCode: searchRegex },
        { letterNumber: searchRegex },
        { 'contentSnapshot.letterMeta.subject': searchRegex },
      ];
    }

    if (query.letterType && query.letterType !== 'all') {
      filter.letterType = query.letterType;
    }

    if (query.branch && query.branch !== 'all') {
      filter.branch = query.branch;
    }

    if (query.department && query.department !== 'all') {
      filter.department = query.department;
    }

    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    if (query.employeeId) {
      filter.employeeId = new Types.ObjectId(query.employeeId);
    }

    if (query.startDate || query.endDate) {
      filter.letterDate = {};
      if (query.startDate) filter.letterDate.$gte = query.startDate;
      if (query.endDate) filter.letterDate.$lte = query.endDate;
    }

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sort: any = { [sortField]: sortOrder };

    const [items, totalItems] = await Promise.all([
      this.letterModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.letterModel.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit) || 1,
      },
    };
  }

  /**
   * Get letters for an employee profile
   */
  async getEmployeeLetters(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) {
      throw new BadRequestException('Invalid employee ID format');
    }
    return this.letterModel
      .find({ employeeId: new Types.ObjectId(employeeId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * KPI / Dashboard Statistics
   */
  async getStats() {
    const totalLetters = await this.letterModel.countDocuments();
    const activeDrafts = await this.letterModel.countDocuments({ status: 'draft' });
    const issuedLetters = await this.letterModel.countDocuments({ status: { $in: ['generated', 'issued', 'reissued'] } });

    // Group by letter type
    const byType = await this.letterModel.aggregate([
      { $group: { _id: '$letterType', count: { $sum: 1 } } },
    ]);

    // Letters issued this current month
    const currentYearMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const thisMonthCount = await this.letterModel.countDocuments({
      letterDate: { $regex: `^${currentYearMonth}` },
      status: { $in: ['generated', 'issued', 'reissued'] },
    });

    return {
      totalLetters,
      activeDrafts,
      issuedLetters,
      thisMonthCount,
      byType: byType.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
    };
  }

  /**
   * Delete letter
   */
  async deleteLetter(id: string, user: any, reqMeta?: { ip?: string; userAgent?: string }) {
    const letter = await this.letterModel.findById(id);
    if (!letter) throw new NotFoundException('Letter not found');

    await this.logAction({
      letterId: letter._id,
      letterNumber: letter.letterNumber,
      employeeId: letter.employeeId,
      employeeName: letter.employeeName,
      action: 'deleted',
      performedBy: {
        id: user?.userId || user?._id,
        name: user?.name || user?.employeeName || 'Authorized HR',
        role: user?.role || 'admin',
      },
      metadata: {
        letterType: letter.letterType,
        letterNumber: letter.letterNumber,
        status: letter.status,
      },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.userAgent,
    });

    await this.letterModel.findByIdAndDelete(id);
    return { success: true, message: 'Letter deleted successfully' };
  }

  /**
   * Log action into audit trail
   */
  async logAction(data: {
    letterId?: Types.ObjectId;
    letterNumber?: string;
    employeeId?: Types.ObjectId;
    employeeName?: string;
    action: string;
    performedBy: { id: Types.ObjectId; name: string; role: string };
    metadata?: Record<string, any>;
    ipAddress?: string;
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
        ipAddress: data.ipAddress || '',
        userAgent: data.userAgent || '',
      });
    } catch (err) {
      this.logger.error(`Failed to create audit log: ${(err as Error).message}`);
    }
  }

  /**
   * Get all audit logs with pagination
   */
  async getAuditLogs(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const filter: any = {};
    if (search) {
      const reg = new RegExp(search.trim(), 'i');
      filter.$or = [
        { letterNumber: reg },
        { employeeName: reg },
        { action: reg },
        { 'performedBy.name': reg },
      ];
    }
    const [items, total] = await Promise.all([
      this.auditModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.auditModel.countDocuments(filter),
    ]);
    return {
      items,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
