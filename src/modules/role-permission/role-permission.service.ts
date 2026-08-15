import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RolePermission, RolePermissionDocument } from './schemas/role-permission.schema';
import { CreateRolePermissionDto } from './dto/create-role-permission.dto';

@Injectable()
export class RolePermissionService {
  constructor(
    @InjectModel(RolePermission.name)
    private readonly rolePermissionModel: Model<RolePermissionDocument>,
  ) {}

  async createOrUpdate(dto: CreateRolePermissionDto) {
    const { role, permissions } = dto;
    return this.rolePermissionModel.findOneAndUpdate(
      { role: role.toUpperCase() },
      { $set: { permissions } },
      { new: true, upsert: true, runValidators: true },
    );
  }

  async findOne(role: string) {
    const perm = await this.rolePermissionModel.findOne({ role: role.toUpperCase() });
    if (!perm) {
      throw new NotFoundException(`No permissions found for role ${role}`);
    }
    return perm;
  }

  async findAll() {
    return this.rolePermissionModel.find({});
  }

  async remove(role: string) {
    const result = await this.rolePermissionModel.findOneAndDelete({
      role: role.toUpperCase(),
    });
    if (!result) {
      throw new NotFoundException(`No permissions found to delete for role ${role}`);
    }
    return { message: 'Permissions deleted successfully' };
  }
}
