import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Department, DepartmentDocument } from './schemas/department.schema';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
  ) {}

  async create(createDto: CreateDepartmentDto) {
    const { name, order } = createDto;

    // Check duplicate name
    const existingName = await this.departmentModel.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (existingName) {
      throw new BadRequestException(`Department "${name}" already exists.`);
    }

    // Check duplicate order
    const existingOrder = await this.departmentModel.findOne({ order });
    if (existingOrder) {
      throw new BadRequestException(`Order number ${order} is already assigned to "${existingOrder.name}".`);
    }

    const newDepartment = new this.departmentModel(createDto);
    return newDepartment.save();
  }

  async findAll(search?: string, status?: string, page?: number, limit?: number) {
    const filter: any = {};
    if (search && search.trim()) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const total = await this.departmentModel.countDocuments(filter);

    let query = this.departmentModel.find(filter).sort({ order: 1, createdAt: -1 });

    if (page && limit) {
      const skip = (page - 1) * limit;
      query = query.skip(skip).limit(limit);
    }

    const data = await query.exec();
    const totalPages = limit ? Math.ceil(total / limit) || 1 : 1;

    // Aggregate system-wide KPI statistics from backend
    const totalDepartments = await this.departmentModel.countDocuments();
    const activeDepartments = await this.departmentModel.countDocuments({ status: 'active' });
    const inactiveDepartments = await this.departmentModel.countDocuments({ status: 'inactive' });
    const maxOrderDoc = await this.departmentModel.findOne().sort({ order: -1 }).select('order').exec();
    const maxDisplayOrder = maxOrderDoc ? maxOrderDoc.order : 0;

    return {
      data,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages,
      stats: {
        totalDepartments,
        activeDepartments,
        inactiveDepartments,
        maxDisplayOrder,
      },
    };
  }

  async findOne(id: string) {
    const department = await this.departmentModel.findById(id);
    if (!department) {
      throw new NotFoundException(`Department not found`);
    }
    return department;
  }

  async update(id: string, updateDto: UpdateDepartmentDto) {
    const department = await this.departmentModel.findById(id);
    if (!department) {
      throw new NotFoundException(`Department not found`);
    }

    if (updateDto.name && updateDto.name.trim().toLowerCase() !== department.name.toLowerCase()) {
      const existingName = await this.departmentModel.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${updateDto.name.trim()}$`, 'i') },
      });
      if (existingName) {
        throw new BadRequestException(`Department "${updateDto.name}" already exists.`);
      }
    }

    if (updateDto.order && updateDto.order !== department.order) {
      const existingOrder = await this.departmentModel.findOne({
        _id: { $ne: id },
        order: updateDto.order,
      });
      if (existingOrder) {
        throw new BadRequestException(`Order number ${updateDto.order} is already assigned to "${existingOrder.name}".`);
      }
    }

    return this.departmentModel.findByIdAndUpdate(id, updateDto, { new: true, runValidators: true });
  }

  async remove(id: string) {
    const result = await this.departmentModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`Department not found`);
    }
    return { message: 'Department deleted successfully' };
  }
}
