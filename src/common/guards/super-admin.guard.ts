import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

// Ported from middleware/authMiddlwares/levelMiddlewares.js. Depends on `request.employee`,
// which only AffiliateGuard would ever populate. Carried over unregistered/inert, like the
// source file (nothing imports this guard).
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if ((request as any).employee?.level !== 'superAdmin') {
      throw new Error('Only SuperAdmin can access this');
    }
    return true;
  }
}
