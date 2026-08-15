import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { Model } from 'mongoose';

// Ported from middleware/affiliateMiddleware.js. That file referenced an `Employee`
// model that was never defined anywhere in the original codebase, so it could never
// actually run if wired up. Carried over unregistered/inert, matching its original
// unreachable status (nothing imports this guard).
@Injectable()
export class AffiliateGuard implements CanActivate {
  constructor(@InjectModel('Employee') private readonly employeeModel: Model<any>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
        (request as any).employee = await this.employeeModel
          .findById(decoded.id)
          .select('-password');
        return true;
      } catch (error) {
        console.log(error);
        throw new Error('Not Authorized');
      }
    }

    throw new Error('Not authorized, no token');
  }
}
