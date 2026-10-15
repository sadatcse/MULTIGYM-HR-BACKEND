import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HrAccessService } from '../../modules/hr-config/hr-access.service';

export const SCOPE_KEY = 'requireScope';
export type RequiredScope = 'all' | 'superadmin';

// Restricts an endpoint to management-level roles ('all' data scope) or to
// Super Admin only — for operations that must never be delegated through
// the configurable permission matrix (audit logs, email relay, triggers).
export const RequireScope = (scope: RequiredScope) => SetMetadata(SCOPE_KEY, scope);

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: HrAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredScope | undefined>(SCOPE_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;
    const role = context.switchToHttp().getRequest().user?.role;
    if (this.access.isSuperAdmin(role)) return true;
    if (required === 'all' && (await this.access.scopeForRole(role)) === 'all' && role) return true;
    throw new ForbiddenException(required === 'superadmin' ? 'Only Super Admin can do this.' : 'Only HR / management can do this.');
  }
}
