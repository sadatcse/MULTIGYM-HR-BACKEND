import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from './schemas/role.schema';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { BaseCrudService } from '../../common/services/base-crud.service';

@Injectable()
export class RoleService extends BaseCrudService<RoleDocument> {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
  ) {
    super(roleModel);
  }

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
    const { data, total, page: pageOut, limit: limitOut, totalPages } = await this.findAllBase({
      search,
      searchFields: ['name'],
      status,
      page,
      limit,
      sort: { order: 1, createdAt: -1 },
    });

    // Aggregate system-wide KPI statistics for Roles
    const totalRoles = await this.roleModel.countDocuments();
    const activeRoles = await this.roleModel.countDocuments({ status: 'active' });
    const inactiveRoles = await this.roleModel.countDocuments({ status: 'inactive' });
    const maxOrderDoc = await this.roleModel.findOne().sort({ order: -1 }).select('order').exec();
    const maxDisplayOrder = maxOrderDoc ? maxOrderDoc.order : 0;

    return {
      data,
      total,
      page: pageOut,
      limit: limitOut,
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
    return this.findOneBase(id, 'Role');
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
    return this.removeBase(id, 'Role');
  }
}
