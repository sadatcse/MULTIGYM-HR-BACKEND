import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RolePermissionService } from '../../modules/role-permission/role-permission.service';
import { HrAccessService } from '../../modules/hr-config/hr-access.service';
import { PERMISSION_KEY, RequiredPermission } from '../decorators/require-permission.decorator';

const SUPER_ADMIN_ROLES = ['SUPER ADMIN', 'SUPERADMIN'];

// Self-service pages every employee may use even when their role has no
// explicit entry (mirrors SELF_SERVICE_KEYS in the frontend PermissionsProvider).
export const SELF_SERVICE_KEYS = new Set([
  'home',
  'chat',
  'my-attendance',
  'my-roster',
  'my-leave',
  'my-payslips',
  'my-notices',
  'my-tasks',
  'my-assets',
  'my-obligations',
  'my-maintenance-requests',
  'my-requisitions',
  'maintenance-create',
  'requisition-create',
  'requisition-details',
  'leave-details',
]);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolePermissionService: RolePermissionService,
    private readonly access: HrAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const role = (request as any).user?.role;
    const roleUpper = typeof role === 'string' ? role.toUpperCase() : '';

    // No role in the token means an unauthenticated / malformed token —
    // previously this was treated as Super Admin.
    if (!roleUpper) throw new ForbiddenException('Your account has no role assigned.');
    if (SUPER_ADMIN_ROLES.includes(roleUpper)) return true;

    let permissions: Record<string, Record<string, boolean>> | undefined;
    try {
      const doc = await this.rolePermissionService.findOne(roleUpper);
      const raw = doc?.permissions;
      permissions = raw instanceof Map ? Object.fromEntries(raw) : (raw as any);
    } catch {
      permissions = undefined; // role has no permission document yet
    }

    const entry = permissions?.[required.moduleKey];
    if (entry != null && entry[required.action] != null) {
      if (!entry[required.action]) this.deny(roleUpper, required);
      return true;
    }

    // Not explicitly configured. Management/HR roles keep the historical
    // default-allow (so a newly added page is never locked out for them),
    // but employee-level ("own records only") roles are denied everything
    // except self-service pages — otherwise an unconfigured role such as
    // "user" could create/edit/delete employees and escalate to admin.
    const scope = await this.access.scopeForRole(roleUpper);
    if (scope === 'self' && !SELF_SERVICE_KEYS.has(required.moduleKey)) this.deny(roleUpper, required);
    return true;
  }

  private deny(role: string, required: RequiredPermission): never {
    throw new ForbiddenException(`Role "${role}" does not have "${required.action}" permission for "${required.moduleKey}".`);
  }
}
