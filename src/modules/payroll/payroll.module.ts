import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { LatePolicy, LatePolicySchema } from '../late-policy/schemas/late-policy.schema';
import { OvertimePolicy, OvertimePolicySchema } from '../overtime/schemas/overtime-policy.schema';
import { LeaveType, LeaveTypeSchema } from '../leave-type/schemas/leave-type.schema';
import { AttendanceRecord, AttendanceRecordSchema } from '../attendance/schemas/attendance.schema';
import {
  EmployeeLoan,
  EmployeeLoanSchema,
  PayrollAdjustment,
  PayrollAdjustmentSchema,
  PayrollRun,
  PayrollRunSchema,
  Payslip,
  PayslipSchema,
  SalaryStructure,
  SalaryStructureSchema,
} from './schemas/payroll.schema';
import { PayrollService } from './payroll.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { EmployeeHistoryModule } from '../employee-history/employee-history.module';
import { HrAccessService } from '../hr-config/hr-access.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('payroll')
@UseGuards(JwtAuthGuard)
export class PayrollController {
  constructor(
    private readonly service: PayrollService,
    private readonly access: HrAccessService,
  ) {}

  private actor(req: any) {
    return this.access.getActor(req.user);
  }

  @Get('my-payslips')
  async myPayslips(@Req() req: any) {
    return { success: true, data: await this.service.myPayslips(await this.actor(req)) };
  }

  // ---- Salary structures --------------------------------------------------
  @Get('structures')
  @UseGuards(PermissionsGuard)
  @RequirePermission('salary-structures', 'view')
  async structures(@Query() query: any, @Req() req: any) {
    return { success: true, data: await this.service.listStructures(query, await this.actor(req)) };
  }

  @Get('structures/:employeeId')
  async structure(@Param('employeeId') id: string, @Req() req: any) {
    return { success: true, data: await this.service.getStructure(id, await this.actor(req)) };
  }

  @Put('structures/:employeeId')
  @UseGuards(PermissionsGuard)
  @RequirePermission('salary-structures', 'edit')
  async saveStructure(@Param('employeeId') id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.saveStructure(id, body, await this.actor(req)), message: 'Salary structure saved' };
  }

  // ---- Loans / advances -------------------------------------------------------
  @Get('loans')
  @UseGuards(PermissionsGuard)
  @RequirePermission('employee-loans', 'view')
  async loans(@Query() query: any, @Req() req: any) {
    return { success: true, ...(await this.service.listLoans(query, await this.actor(req))) };
  }

  @Post('loans')
  @UseGuards(PermissionsGuard)
  @RequirePermission('employee-loans', 'add')
  async createLoan(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.createLoan(body, await this.actor(req)), message: 'Advance / loan recorded' };
  }

  @Patch('loans/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('employee-loans', 'edit')
  async updateLoan(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.updateLoan(id, body, await this.actor(req)), message: 'Updated' };
  }

  // ---- Adjustments ------------------------------------------------------------
  @Get('adjustments')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payroll', 'view')
  async adjustments(@Query() query: any, @Req() req: any) {
    return { success: true, data: await this.service.listAdjustments(query, await this.actor(req)) };
  }

  @Post('adjustments')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payroll', 'add')
  async createAdjustments(@Body() body: any, @Req() req: any) {
    const data = await this.service.createAdjustments(body, await this.actor(req));
    return { success: true, data, message: `${data.length} adjustment(s) added` };
  }

  @Delete('adjustments/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payroll', 'delete')
  async removeAdjustment(@Param('id') id: string, @Req() req: any) {
    return this.service.removeAdjustment(id, await this.actor(req));
  }

  // ---- Runs -------------------------------------------------------------------
  @Get('runs')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payroll', 'view')
  async runs(@Query() query: any, @Req() req: any) {
    return { success: true, data: await this.service.listRuns(query, await this.actor(req)) };
  }

  @Get('runs/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payroll', 'view')
  async run(@Param('id') id: string, @Req() req: any) {
    return { success: true, data: await this.service.getRun(id, await this.actor(req)) };
  }

  @Post('runs/generate')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payroll', 'add')
  async generate(@Body() body: any, @Req() req: any) {
    const data = await this.service.generate(body, await this.actor(req));
    return { success: true, data, message: `Salary sheet generated for ${data.generated} employee(s)` };
  }

  @Patch('payslips/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payroll', 'edit')
  async updatePayslip(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.updatePayslip(id, body, await this.actor(req)), message: 'Payslip updated' };
  }

  @Post('runs/:id/finalize')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payroll', 'edit')
  async finalize(@Param('id') id: string, @Req() req: any) {
    return { success: true, data: await this.service.finalize(id, await this.actor(req)), message: 'Payroll finalized' };
  }

  @Post('runs/:id/paid')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payroll', 'edit')
  async paid(@Param('id') id: string, @Req() req: any) {
    return { success: true, data: await this.service.markPaid(id, await this.actor(req)), message: 'Payroll marked as paid' };
  }

  @Post('runs/:id/reopen')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payroll', 'edit')
  async reopen(@Param('id') id: string, @Req() req: any) {
    return { success: true, data: await this.service.reopen(id, await this.actor(req)), message: 'Payroll reopened as draft' };
  }

  @Delete('runs/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payroll', 'delete')
  async removeRun(@Param('id') id: string, @Req() req: any) {
    return this.service.removeRun(id, await this.actor(req));
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SalaryStructure.name, schema: SalaryStructureSchema },
      { name: EmployeeLoan.name, schema: EmployeeLoanSchema },
      { name: PayrollAdjustment.name, schema: PayrollAdjustmentSchema },
      { name: PayrollRun.name, schema: PayrollRunSchema },
      { name: Payslip.name, schema: PayslipSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: LatePolicy.name, schema: LatePolicySchema },
      { name: OvertimePolicy.name, schema: OvertimePolicySchema },
      { name: LeaveType.name, schema: LeaveTypeSchema },
      { name: AttendanceRecord.name, schema: AttendanceRecordSchema },
    ]),
    AttendanceModule,
    EmployeeHistoryModule,
  ],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
