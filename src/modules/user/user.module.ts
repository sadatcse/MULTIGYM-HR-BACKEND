import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Employee, EmployeeSchema } from './schemas/employee.schema';
import { EmployeeService, UserService } from './employee.service';
import { EmployeeController, UserController } from './employee.controller';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Employee.name, schema: EmployeeSchema }]),
    UploadModule,
  ],
  controllers: [EmployeeController, UserController],
  providers: [EmployeeService, UserService],
  exports: [EmployeeService, UserService],
})
export class EmployeeModule {}

// Module alias for backward compatibility
export class UserModule extends EmployeeModule {}
