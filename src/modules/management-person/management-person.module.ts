import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ManagementPerson, ManagementPersonSchema } from './schemas/management-person.schema';
import { ManagementPersonService } from './management-person.service';
import { ManagementPersonController } from './management-person.controller';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ManagementPerson.name, schema: ManagementPersonSchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
    RolePermissionModule,
  ],
  controllers: [ManagementPersonController],
  providers: [ManagementPersonService],
  exports: [ManagementPersonService],
})
export class ManagementPersonModule {}
