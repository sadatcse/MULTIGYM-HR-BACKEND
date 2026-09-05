import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolePermission, RolePermissionSchema } from './schemas/role-permission.schema';
import { RolePermissionService } from './role-permission.service';
import { RolePermissionController } from './role-permission.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

// Global so PermissionsGuard (used via @UseGuards across every feature
// module's controllers) can inject RolePermissionService without every one
// of those modules needing to import RolePermissionModule individually.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: RolePermission.name, schema: RolePermissionSchema }]),
  ],
  controllers: [RolePermissionController],
  providers: [RolePermissionService, PermissionsGuard],
  exports: [RolePermissionService, PermissionsGuard],
})
export class RolePermissionModule {}
