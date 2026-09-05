import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MaintenanceRequest, MaintenanceRequestSchema } from './schemas/maintenance-request.schema';
import { MaintenanceWorkUpdate, MaintenanceWorkUpdateSchema } from './schemas/maintenance-work-update.schema';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { Vendor, VendorSchema } from '../vendor/schemas/vendor.schema';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MaintenanceRequest.name, schema: MaintenanceRequestSchema },
      { name: MaintenanceWorkUpdate.name, schema: MaintenanceWorkUpdateSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
  ],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
