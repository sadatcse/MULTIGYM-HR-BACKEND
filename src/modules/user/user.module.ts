import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Employee, EmployeeSchema } from './schemas/employee.schema';
import { EmployeeService, UserService } from './employee.service';
import { EmployeeController, UserController } from './employee.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Employee.name, schema: EmployeeSchema }]),
  ],
  controllers: [EmployeeController, UserController],
  providers: [EmployeeService, UserService],
  exports: [EmployeeService, UserService],
})
export class EmployeeModule {}

// Module alias for backward compatibility
export class UserModule extends EmployeeModule {}
