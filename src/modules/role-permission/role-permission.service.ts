import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RolePermission, RolePermissionDocument } from './schemas/role-permission.schema';
import { CreateRolePermissionDto } from './dto/create-role-permission.dto';

// Deliberately NOT the broader task/maintenance ADMIN_ROLES list — the live
// permission data has ADMIN's own "role-permissions" entry explicitly set to
// all-false, so ADMIN is meant to be excluded here too. Matches
// PermissionsGuard's own SUPER_ADMIN_ROLES bypass list exactly.
const SUPER_ADMIN_ROLES = ['SUPERADMIN', 'SUPER ADMIN'];

@Injectable()
export class RolePermissionService {
  constructor(
    @InjectModel(RolePermission.name)
    private readonly rolePermissionModel: Model<RolePermissionDocument>,
  ) {}

  private isSuperAdmin(role?: string): boolean {
    if (!role) return false;
    return SUPER_ADMIN_ROLES.includes(role.toUpperCase());
  }

  // Hardcoded floor alongside the configurable RequirePermission guard:
  // PermissionsGuard allows an action by default when a role has no stored
  // entry for a module (so a newly added module never accidentally locks
  // out an existing role) — but role-permissions is the one module where
  // that default-allow is a privilege-escalation hole (any role with no
  // configured "role-permissions" entry could otherwise grant itself admin
  // rights on everything). See PermissionsGuard for the general policy.
  async createOrUpdate(dto: CreateRolePermissionDto, actingUserRole?: string) {
    if (!this.isSuperAdmin(actingUserRole)) {
      throw new ForbiddenException('Only Super Admin can modify role permissions');
    }

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

  async remove(role: string, actingUserRole?: string) {
    if (!this.isSuperAdmin(actingUserRole)) {
      throw new ForbiddenException('Only Super Admin can delete role permissions');
    }

    const result = await this.rolePermissionModel.findOneAndDelete({
      role: role.toUpperCase(),
    });
    if (!result) {
      throw new NotFoundException(`No permissions found to delete for role ${role}`);
    }
    return { message: 'Permissions deleted successfully' };
  }
}
