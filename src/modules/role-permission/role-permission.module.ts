import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolePermission, RolePermissionSchema } from './schemas/role-permission.schema';
import { RolePermissionService } from './role-permission.service';
import { RolePermissionController } from './role-permission.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RolePermission.name, schema: RolePermissionSchema }]),
  ],
  controllers: [RolePermissionController],
  providers: [RolePermissionService],
  exports: [RolePermissionService],
})
export class RolePermissionModule {}
