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
    const roleUpper = role.toUpperCase();

    // Merge into the existing stored map rather than replacing it wholesale —
    // a caller that only sends a subset of module keys (e.g. after a new
    // module is added and only that module's row is touched) must not wipe
    // out every other module's previously-saved permissions for this role.
    const existing = await this.rolePermissionModel.findOne({ role: roleUpper });
    const existingPermissions = existing
      ? Object.fromEntries(existing.permissions instanceof Map ? existing.permissions : Object.entries(existing.permissions || {}))
      : {};

    const mergedPermissions = { ...existingPermissions, ...permissions };

    return this.rolePermissionModel.findOneAndUpdate(
      { role: roleUpper },
      { $set: { permissions: mergedPermissions } },
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
