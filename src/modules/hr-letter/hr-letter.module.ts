import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HrLetterController } from './hr-letter.controller';
import { HrLetterService } from './hr-letter.service';
import {
  HrLetterTemplate,
  HrLetterTemplateSchema,
} from './schemas/hr-letter-template.schema';
import {
  EmployeeHrLetter,
  EmployeeHrLetterSchema,
} from './schemas/employee-hr-letter.schema';
import {
  HrLetterAuditLog,
  HrLetterAuditLogSchema,
} from './schemas/hr-letter-audit-log.schema';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { Setting, SettingSchema } from '../setting/schemas/setting.schema';
import { Branch, BranchSchema } from '../branch/schemas/branch.schema';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { SettingModule } from '../setting/setting.module';
import { BranchModule } from '../branch/branch.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HrLetterTemplate.name, schema: HrLetterTemplateSchema },
      { name: EmployeeHrLetter.name, schema: EmployeeHrLetterSchema },
      { name: HrLetterAuditLog.name, schema: HrLetterAuditLogSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: Setting.name, schema: SettingSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    RolePermissionModule,
    SettingModule,
    BranchModule,
  ],
  controllers: [HrLetterController],
  providers: [HrLetterService],
  exports: [HrLetterService],
})
export class HrLetterModule {}
