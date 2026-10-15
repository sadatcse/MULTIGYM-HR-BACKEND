import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Employee, EmployeeDocument } from './schemas/employee.schema';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ChangePasswordEmployeeDto } from './dto/change-password-employee.dto';
import { S3Service } from '../upload/s3.service';
import { EmployeeHistoryService, snapshotOf } from '../employee-history/employee-history.service';
import { Actor, HrAccessService, normalizeRole } from '../hr-config/hr-access.service';

// Fields safe to show any colleague (pickers, chat, other-branch lookups).
const LITE_FIELDS = 'name employeeId photo jobPosition department branches status role';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    private readonly s3Service: S3Service,
    private readonly historyService: EmployeeHistoryService,
    private readonly access: HrAccessService,
  ) {}

  // Get all employees with multi-field search (including nested address & contact), filters, stats
  async findAll(query: Record<string, any>, actor?: Actor) {
    try {
      const str = (v: any) => (typeof v === 'string' ? v : undefined);
      const search = str(query.search); // already regex-escaped by sanitizeRequest
      const role = str(query.role);
      const status = str(query.status);
      const department = str(query.department);
      const branch = str(query.branch);
      const employeeType = str(query.employeeType);
      const page = Math.max(1, parseInt(query.page, 10) || 1);
      const limit = Math.min(1000, Math.max(1, parseInt(query.limit, 10) || 10));
      const skip = (page - 1) * limit;

      // Data scope: employees see only themselves, branch in-charges only
      // their own branch(es). Applied to the list and to the stat counters.
      const scopeBase: Record<string, any> = {};
      if (actor?.scope === 'self') scopeBase._id = actor.id;
      else if (actor?.scope === 'branch') scopeBase.branches = { $in: actor.branches };
      const queryFilter: Record<string, any> = { ...scopeBase };

      if (search) {
        queryFilter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } },
          { mobileNumber: { $regex: search, $options: 'i' } },
          { nidPassport: { $regex: search, $options: 'i' } },
          { department: { $regex: search, $options: 'i' } },
          { jobPosition: { $regex: search, $options: 'i' } },
          { branches: { $regex: search, $options: 'i' } },
          { role: { $regex: search, $options: 'i' } },
          { 'presentAddress.city': { $regex: search, $options: 'i' } },
          { 'presentAddress.area': { $regex: search, $options: 'i' } },
          { 'presentAddress.division': { $regex: search, $options: 'i' } },
          { 'emergencyContact.name': { $regex: search, $options: 'i' } },
          { 'emergencyContact.mobileNumber': { $regex: search, $options: 'i' } },
        ];
      }

      if (role && role !== 'all') {
        queryFilter.role = role.toLowerCase();
      }

      if (status && status !== 'all') {
        queryFilter.status = status.toLowerCase();
      }

      if (department && department !== 'all') {
        queryFilter.department = department;
      }

      if (branch && branch !== 'all') {
        queryFilter.branches = actor?.scope === 'branch' && !actor.branches.includes(branch) ? { $in: [] } : branch;
      }

      if (employeeType && employeeType !== 'all') {
        queryFilter.employeeType = employeeType;
      }

      const [
        totalItems,
        employees,
        activeCount,
        probationCount,
        resignedCount,
        terminatedCount,
        inactiveCount,
        adminCount,
      ] = await Promise.all([
        this.employeeModel.countDocuments(queryFilter),
        this.employeeModel
          .find(queryFilter)
          .select('-password')
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip),
        this.employeeModel.countDocuments({ ...scopeBase, ...{ status: 'active' } }),
        this.employeeModel.countDocuments({ ...scopeBase, ...{ status: 'probation' } }),
        this.employeeModel.countDocuments({ ...scopeBase, ...{ status: 'resigned' } }),
        this.employeeModel.countDocuments({ ...scopeBase, ...{ status: 'terminated' } }),
        this.employeeModel.countDocuments({ ...scopeBase, ...{ status: 'inactive' } }),
        this.employeeModel.countDocuments({ ...scopeBase, ...{ role: { $in: ['admin', 'superadmin'] } } }),
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      return {
        data: employees,
        total: totalItems,
        totalPages,
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          itemsPerPage: limit,
        },
        stats: {
          totalEmployees: totalItems,
          activeEmployees: activeCount,
          probationEmployees: probationCount,
          resignedEmployees: resignedCount,
          terminatedEmployees: terminatedCount,
          inactiveEmployees: inactiveCount,
          adminEmployees: adminCount,
        },
      };
    } catch (err) {
      console.error('Error in findAll Employees:', err);
      throw new Error('An error occurred while fetching employees.');
    }
  }

  async findById(id: string) {
    const result = await this.employeeModel.findById(id).select('-password');
    if (!result) {
      throw new NotFoundException('Employee not found');
    }
    return result;
  }

  async findByEmail(email: string) {
    return this.employeeModel.findOne({ email });
  }

  async create(createDto: CreateEmployeeDto, actor?: { id: string; name: string; role: string }) {
    const existing = await this.employeeModel.findOne({ email: createDto.email });
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    if (!createDto.employeeId) {
      const count = await this.employeeModel.countDocuments();
      createDto.employeeId = `EMP-${(count + 1).toString().padStart(4, '0')}`;
    }

    const { skipHistory, ...payload } = createDto as any;
    const newEmp = await this.employeeModel.create(payload);
    if (!skipHistory) {
      await this.historyService
        .record({
          employeeId: String(newEmp._id),
          eventType: 'appointment',
          effectiveDate: newEmp.joiningDate || undefined,
          to: snapshotOf(newEmp),
          sourceModule: 'employee',
          recordedBy: actor || null,
        })
        .catch((e) => console.error('History (appointment) not recorded:', e?.message));
    }
    const response: any = newEmp.toObject();
    delete response.password;
    return response;
  }

  async remove(id: string) {
    const result = await this.employeeModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Employee not found');
    }
    void this.s3Service.deleteByUrl(result.photo);
    return { message: 'Employee deleted successfully' };
  }

  async update(id: string, updateDto: UpdateEmployeeDto, actor?: { id: string; name: string; role: string }) {
    const employee = await this.employeeModel.findById(id);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const previousPhoto = employee.photo;
    const before = snapshotOf(employee);
    const skipHistory = !!(updateDto as any).skipHistory;

    Object.keys(updateDto).forEach((key) => {
      if (key === 'skipHistory') return;
      if (key === 'password') {
        const val = (updateDto as any).password;
        if (!val || !String(val).trim()) return;
      }
      (employee as any)[key] = (updateDto as any)[key];
    });

    try {
      const updated = await employee.save();
      if (!skipHistory) {
        await this.historyService
          .recordProfileChanges(String(updated._id), before, snapshotOf(updated), actor || null)
          .catch((e) => console.error('History (profile change) not recorded:', e?.message));
      }
      if (updateDto.photo && updateDto.photo !== previousPhoto) {
        void this.s3Service.deleteByUrl(previousPhoto);
      }
      const response: any = updated.toObject();
      delete response.password;
      return response;
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException('An error occurred: email or employee ID may already be in use.');
      }
      console.error('Error updating employee:', err);
      throw new BadRequestException(err.message || 'An error occurred while updating the employee.');
    }
  }

  async directory(includeInactive = false) {
    const filter = includeInactive ? {} : { status: { $nin: ['resigned', 'terminated', 'inactive'] } };
    const data = await this.employeeModel.find(filter).select(LITE_FIELDS).sort({ name: 1 }).lean();
    return { data, total: data.length };
  }

  // Full profile for self / management / same-branch in-charge; colleague
  // card (no personal or salary fields) for everyone else.
  async findByIdFor(id: string, actor: Actor) {
    const emp: any = await this.employeeModel.findById(id).select('-password').lean();
    if (!emp) throw new NotFoundException('Employee not found');
    const full =
      actor.scope === 'all' ||
      String(emp._id) === actor.id ||
      (actor.scope === 'branch' && (emp.branches || []).some((b: string) => actor.branches.includes(b)));
    if (full) return emp;
    const lite: any = {};
    for (const k of LITE_FIELDS.split(' ')) lite[k] = emp[k];
    lite._id = emp._id;
    return lite;
  }

  private isSuperRole(role?: string) {
    return ['SUPERADMIN'].includes(normalizeRole(role));
  }

  // Authorization for create (targetId = null) and update.
  async assertCanWrite(actor: Actor, targetId: string | null, dto: any) {
    if (actor.scope === 'self') throw new ForbiddenException('You cannot manage employee records');
    const target = targetId ? await this.employeeModel.findById(targetId).select('role branches').lean() : null;
    if (targetId && !target) throw new NotFoundException('Employee not found');

    if (target && this.isSuperRole(target.role) && !actor.isSuperAdmin) {
      throw new ForbiddenException('Only Super Admin can modify a Super Admin account');
    }
    if (dto.role !== undefined && dto.role !== (target?.role ?? 'user')) {
      if (targetId === actor.id && !actor.isSuperAdmin) throw new ForbiddenException('You cannot change your own role');
      if (actor.scope !== 'all') throw new ForbiddenException('Only HR / management can assign roles');
      if (this.isSuperRole(dto.role) && !actor.isSuperAdmin) throw new ForbiddenException('Only Super Admin can grant Super Admin');
    }
    if (actor.scope === 'branch') {
      if (target && !(target.branches || []).some((b: string) => actor.branches.includes(b))) {
        throw new ForbiddenException('You can only manage employees of your own branch');
      }
      const next: string[] = Array.isArray(dto.branches) ? dto.branches : (target?.branches as string[]) || [];
      if (!next.length || next.some((b) => !actor.branches.includes(b))) {
        throw new ForbiddenException('Employees must stay within your own branch(es)');
      }
      for (const k of ['basicSalary', 'grossSalary']) {
        if (dto[k] !== undefined) throw new ForbiddenException('Salary can only be changed by HR / management');
      }
    }
  }

  async assertCanDelete(actor: Actor, targetId: string) {
    if (actor.scope !== 'all') throw new ForbiddenException('Only HR / management can delete employees');
    if (targetId === actor.id) throw new ForbiddenException('You cannot delete your own account');
    const target = await this.employeeModel.findById(targetId).select('role').lean();
    if (target && this.isSuperRole(target.role) && !actor.isSuperAdmin) throw new ForbiddenException('Only Super Admin can delete a Super Admin');
  }

  async changePassword(employeeId: string | undefined, dto: ChangePasswordEmployeeDto) {
    if (!employeeId) {
      throw new UnauthorizedException('Authentication error, employee ID not found.');
    }

    try {
      const employee = await this.employeeModel.findById(employeeId);
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      const isMatch = await employee.comparePassword(dto.oldPassword);
      if (!isMatch) {
        throw new UnauthorizedException('Incorrect old password');
      }

      employee.password = dto.newPassword;
      await employee.save();

      return { message: 'Password updated successfully' };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('Error changing employee password:', err);
      throw new InternalServerErrorException({
        message: 'Internal server error',
        error: (err as Error).message,
      });
    }
  }
}

// Service alias for backward compatibility
@Injectable()
export class UserService extends EmployeeService {}
