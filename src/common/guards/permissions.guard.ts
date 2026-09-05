import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RolePermissionService } from '../../modules/role-permission/role-permission.service';
import { PERMISSION_KEY, RequiredPermission } from '../decorators/require-permission.decorator';

const SUPER_ADMIN_ROLES = ['SUPER ADMIN', 'SUPERADMIN'];

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolePermissionService: RolePermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const role = (request as any).user?.role;
    const roleUpper = typeof role === 'string' ? role.toUpperCase() : '';

    if (!roleUpper || SUPER_ADMIN_ROLES.includes(roleUpper)) {
      return true;
    }

    // Mirrors PermissionsProvider.jsx's `can()` exactly: a role with no
    // stored permission document, or no entry for this module/action, is
    // allowed by default (so a newly added module/page is never accidentally
    // locked out, and an existing live role's incomplete permission doc
    // never starts 403'ing actions that work today).
    let permissions: Record<string, Record<string, boolean>> | undefined;
    try {
      const doc = await this.rolePermissionService.findOne(roleUpper);
      const raw = doc?.permissions;
      permissions = raw instanceof Map ? Object.fromEntries(raw) : (raw as any);
    } catch {
      return true;
    }

    const modulePerm = permissions?.[required.moduleKey];
    if (modulePerm == null || modulePerm[required.action] == null) {
      return true;
    }

    if (!modulePerm[required.action]) {
      throw new ForbiddenException(
        `Role "${roleUpper}" does not have "${required.action}" permission for "${required.moduleKey}".`,
      );
    }

    return true;
  }
}
