import {
  BadRequestException,
  ConflictException,
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

@Injectable()
export class EmployeeService {
  constructor(
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
  ) {}

  // Get all employees with multi-field search (including nested address & contact), filters, stats
  async findAll(query: Record<string, any>) {
    try {
      const { search, role, status, department, branch, employeeType } = query;
      const page = parseInt(query.page, 10) || 1;
      const limit = parseInt(query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      const queryFilter: Record<string, any> = {};

      if (search) {
        queryFilter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } },
          { mobileNumber: { $regex: search, $options: 'i' } },
          { nidPassport: { $regex: search, $options: 'i' } },
          { department: { $regex: search, $options: 'i' } },
          { jobPosition: { $regex: search, $options: 'i' } },
          { branch: { $regex: search, $options: 'i' } },
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
        queryFilter.branch = branch;
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
        this.employeeModel.countDocuments({ status: 'active' }),
        this.employeeModel.countDocuments({ status: 'probation' }),
        this.employeeModel.countDocuments({ status: 'resigned' }),
        this.employeeModel.countDocuments({ status: 'terminated' }),
        this.employeeModel.countDocuments({ status: 'inactive' }),
        this.employeeModel.countDocuments({ role: { $in: ['admin', 'superadmin'] } }),
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

  async create(createDto: CreateEmployeeDto) {
    const existing = await this.employeeModel.findOne({ email: createDto.email });
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    if (!createDto.employeeId) {
      const count = await this.employeeModel.countDocuments();
      createDto.employeeId = `EMP-${(count + 1).toString().padStart(4, '0')}`;
    }

    const newEmp = await this.employeeModel.create(createDto);
    const response: any = newEmp.toObject();
    delete response.password;
    return response;
  }

  async remove(id: string) {
    const result = await this.employeeModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Employee not found');
    }
    return { message: 'Employee deleted successfully' };
  }

  async update(id: string, updateDto: UpdateEmployeeDto) {
    const employee = await this.employeeModel.findById(id);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    Object.keys(updateDto).forEach((key) => {
      if (key === 'password') {
        const val = (updateDto as any).password;
        if (!val || !String(val).trim()) return;
      }
      (employee as any)[key] = (updateDto as any)[key];
    });

    try {
      const updated = await employee.save();
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
