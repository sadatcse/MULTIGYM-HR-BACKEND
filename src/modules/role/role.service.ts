import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from './schemas/role.schema';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RoleService {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
  ) {}

  async create(createDto: CreateRoleDto) {
    const { name, order } = createDto;

    // Check duplicate name
    const existingName = await this.roleModel.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (existingName) {
      throw new BadRequestException(`Role "${name}" already exists.`);
    }

    // Check duplicate order
    const existingOrder = await this.roleModel.findOne({ order });
    if (existingOrder) {
      throw new BadRequestException(`Order number ${order} is already assigned to "${existingOrder.name}".`);
    }

    const newRole = new this.roleModel(createDto);
    return newRole.save();
  }

  async findAll(search?: string, status?: string, page?: number, limit?: number) {
    const filter: any = {};
    if (search && search.trim()) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const total = await this.roleModel.countDocuments(filter);

    let query = this.roleModel.find(filter).sort({ order: 1, createdAt: -1 });

    if (page && limit) {
      const skip = (page - 1) * limit;
      query = query.skip(skip).limit(limit);
    }

    const data = await query.exec();
    const totalPages = limit ? Math.ceil(total / limit) || 1 : 1;

    // Aggregate system-wide KPI statistics for Roles
    const totalRoles = await this.roleModel.countDocuments();
    const activeRoles = await this.roleModel.countDocuments({ status: 'active' });
    const inactiveRoles = await this.roleModel.countDocuments({ status: 'inactive' });
    const maxOrderDoc = await this.roleModel.findOne().sort({ order: -1 }).select('order').exec();
    const maxDisplayOrder = maxOrderDoc ? maxOrderDoc.order : 0;

    return {
      data,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages,
      stats: {
        totalRoles,
        activeRoles,
        inactiveRoles,
        maxDisplayOrder,
      },
    };
  }

  async findOne(id: string) {
    const role = await this.roleModel.findById(id);
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }
    return role;
  }

  async update(id: string, updateDto: UpdateRoleDto) {
    const role = await this.roleModel.findById(id);
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    if (updateDto.name && updateDto.name.trim().toLowerCase() !== role.name.toLowerCase()) {
      const existingName = await this.roleModel.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${updateDto.name.trim()}$`, 'i') },
      });
      if (existingName) {
        throw new BadRequestException(`Role "${updateDto.name}" already exists.`);
      }
    }

    if (updateDto.order && updateDto.order !== role.order) {
      const existingOrder = await this.roleModel.findOne({
        _id: { $ne: id },
        order: updateDto.order,
      });
      if (existingOrder) {
        throw new BadRequestException(`Order number ${updateDto.order} is already assigned to "${existingOrder.name}".`);
      }
    }

    return this.roleModel.findByIdAndUpdate(id, updateDto, { new: true, runValidators: true });
  }

  async remove(id: string) {
    const result = await this.roleModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`Role not found`);
    }
    return { message: 'Role deleted successfully' };
  }
}
