import { Injectable, NotFoundException, OnModuleInit, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ManagementPerson, ManagementPersonDocument } from './schemas/management-person.schema';
import { CreateManagementPersonDto } from './dto/create-management-person.dto';
import { UpdateManagementPersonDto } from './dto/update-management-person.dto';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';

@Injectable()
export class ManagementPersonService implements OnModuleInit {
  constructor(
    @InjectModel(ManagementPerson.name)
    private readonly managementPersonModel: Model<ManagementPersonDocument>,
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
  ) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  /**
   * Seed standard management authorities if table is empty
   */
  async seedDefaults() {
    try {
      const count = await this.managementPersonModel.countDocuments();
      if (count === 0) {
        const defaults = [
          {
            title: 'MD Sir',
            code: 'MD_SIR',
            designation: 'Managing Director',
            priorityOrder: 1,
            canIssueInstructions: true,
            canApproveTasks: true,
            status: 'active',
            notes: 'Chief executive and primary directive authority',
          },
          {
            title: 'Director Sir',
            code: 'DIRECTOR_SIR',
            designation: 'Director',
            priorityOrder: 2,
            canIssueInstructions: true,
            canApproveTasks: true,
            status: 'active',
            notes: 'Board director and senior directive authority',
          },
          {
            title: 'Management',
            code: 'MANAGEMENT',
            designation: 'Executive Management',
            priorityOrder: 3,
            canIssueInstructions: true,
            canApproveTasks: true,
            status: 'active',
            notes: 'General management directives and notices',
          },
          {
            title: 'Admin & HR',
            code: 'ADMIN_HR',
            designation: 'Head of Admin & HR',
            priorityOrder: 4,
            canIssueInstructions: true,
            canApproveTasks: true,
            status: 'active',
            notes: 'HR and administrative operational instructions',
          },
        ];

        await this.managementPersonModel.insertMany(defaults);
        console.log('[ManagementPersonService] Successfully seeded default management authorities.'.green);
      }
    } catch (err) {
      console.error('[ManagementPersonService] Failed to seed default management authorities:', err);
    }
  }

  /**
   * Create a new management person / authority
   */
  async create(createDto: CreateManagementPersonDto, userId?: string) {
    const payload: any = { ...createDto };

    // Auto-generate code if missing
    if (!payload.code && payload.title) {
      payload.code = payload.title.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    }

    // Auto-fill employee details if linked employee is specified
    if (payload.employee && Types.ObjectId.isValid(payload.employee)) {
      const emp = await this.employeeModel.findById(payload.employee);
      if (emp) {
        payload.employee = emp._id;
        if (!payload.employeeName) payload.employeeName = emp.name;
        if (!payload.employeeId) payload.employeeId = (emp as any).employeeId || '';
        if (!payload.email) payload.email = emp.email;
        if (!payload.phone) payload.phone = (emp as any).mobileNumber || (emp as any).phone || '';
        if (!payload.department) payload.department = emp.department;
        if (!payload.branch) payload.branch = emp.branch;
        if (!payload.avatar) payload.avatar = (emp as any).photo || '';
      }
    } else {
      payload.employee = null;
    }

    if (userId && Types.ObjectId.isValid(userId)) {
      payload.createdBy = new Types.ObjectId(userId);
    }

    const doc = new this.managementPersonModel(payload);
    await doc.save();
    return this.findOne(doc._id.toString());
  }

  /**
   * Find all management persons with search, filter, and stats
   */
  async findAll(search?: string, status?: string, page = 1, limit = 10) {
    const filter: any = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { title: { $regex: term, $options: 'i' } },
        { code: { $regex: term, $options: 'i' } },
        { employeeName: { $regex: term, $options: 'i' } },
        { designation: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { employeeId: { $regex: term, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.managementPersonModel
        .find(filter)
        .populate('employee', 'name email phone photo designation employeeId department branch')
        .sort({ priorityOrder: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.managementPersonModel.countDocuments(filter).exec(),
    ]);

    // Aggregate statistics
    const [totalCount, activeCount, inactiveCount, assignedEmployeesCount] = await Promise.all([
      this.managementPersonModel.countDocuments(),
      this.managementPersonModel.countDocuments({ status: 'active' }),
      this.managementPersonModel.countDocuments({ status: 'inactive' }),
      this.managementPersonModel.countDocuments({ employee: { $ne: null } }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      stats: {
        totalCount,
        activeCount,
        inactiveCount,
        assignedEmployeesCount,
      },
    };
  }

  /**
   * Return all active management persons for dropdowns
   */
  async findAllActive() {
    return this.managementPersonModel
      .find({ status: 'active' })
      .populate('employee', 'name email phone photo designation employeeId department branch')
      .sort({ priorityOrder: 1, createdAt: 1 })
      .exec();
  }

  /**
   * Find one management person by ID
   */
  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid management person ID');
    }
    const doc = await this.managementPersonModel
      .findById(id)
      .populate('employee', 'name email phone photo designation employeeId department branch')
      .exec();
    if (!doc) {
      throw new NotFoundException('Management person not found');
    }
    return doc;
  }

  /**
   * Update management person by ID
   */
  async update(id: string, updateDto: UpdateManagementPersonDto, userId?: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid management person ID');
    }

    const payload: any = { ...updateDto };

    // Sync employee details if an employee is specified or modified
    if (payload.employee !== undefined) {
      if (payload.employee && Types.ObjectId.isValid(payload.employee)) {
        const emp = await this.employeeModel.findById(payload.employee);
        if (emp) {
          payload.employee = emp._id;
          if (!payload.employeeName) payload.employeeName = emp.name;
          if (!payload.employeeId) payload.employeeId = (emp as any).employeeId || '';
          if (!payload.email) payload.email = emp.email;
          if (!payload.phone) payload.phone = (emp as any).mobileNumber || (emp as any).phone || '';
          if (!payload.department) payload.department = emp.department;
          if (!payload.branch) payload.branch = emp.branch;
          if (!payload.avatar) payload.avatar = (emp as any).photo || '';
        }
      } else {
        payload.employee = null;
        if (!payload.employeeName) payload.employeeName = '';
        if (!payload.employeeId) payload.employeeId = '';
        if (!payload.avatar) payload.avatar = '';
      }
    }

    if (userId && Types.ObjectId.isValid(userId)) {
      payload.updatedBy = new Types.ObjectId(userId);
    }

    const updated = await this.managementPersonModel
      .findByIdAndUpdate(id, payload, { new: true })
      .populate('employee', 'name email phone photo designation employeeId department branch')
      .exec();

    if (!updated) {
      throw new NotFoundException('Management person not found');
    }

    return updated;
  }

  /**
   * Delete management person
   */
  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid management person ID');
    }
    const deleted = await this.managementPersonModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Management person not found');
    }
    return { success: true, message: 'Management person deleted successfully' };
  }
}
