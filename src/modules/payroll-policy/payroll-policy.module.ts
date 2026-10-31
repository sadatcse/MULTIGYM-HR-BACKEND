import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AllowanceRule, AllowanceRuleSchema } from './schemas/allowance-rule.schema';
import { CommissionEntry, CommissionEntrySchema, CommissionPlan, CommissionPlanSchema } from './schemas/commission.schema';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { PayrollRun, PayrollRunSchema } from '../payroll/schemas/payroll.schema';
import { AllowanceRuleService } from './allowance-rule.service';
import { CommissionService } from './commission.service';
import { HrAccessService } from '../hr-config/hr-access.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

// Allowances & duty pay rules (applied automatically by payroll).
@Controller('allowance-rules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AllowanceRuleController {
  constructor(
    private readonly service: AllowanceRuleService,
    private readonly access: HrAccessService,
  ) {}

  private actor(req: any) {
    return this.access.getActor(req.user);
  }

  @Get()
  @RequirePermission('allowance-policy', 'view')
  async list(@Query() query: any) {
    return { success: true, ...(await this.service.list(query)) };
  }

  @Post()
  @RequirePermission('allowance-policy', 'add')
  async create(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.create(body, await this.actor(req)), message: 'Allowance rule created' };
  }

  @Patch(':id')
  @RequirePermission('allowance-policy', 'edit')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.update(id, body, await this.actor(req)), message: 'Allowance rule updated' };
  }

  @Delete(':id')
  @RequirePermission('allowance-policy', 'delete')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, await this.actor(req));
  }
}

// Commission plans (rates & targets) and the monthly commission sheet.
@Controller('commission')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommissionController {
  constructor(
    private readonly service: CommissionService,
    private readonly access: HrAccessService,
  ) {}

  private actor(req: any) {
    return this.access.getActor(req.user);
  }

  @Get('plans')
  @RequirePermission('commission-policy', 'view')
  async plans(@Query() query: any) {
    return { success: true, ...(await this.service.listPlans(query)) };
  }

  @Post('plans')
  @RequirePermission('commission-policy', 'add')
  async createPlan(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.createPlan(body, await this.actor(req)), message: 'Commission plan created' };
  }

  @Patch('plans/:id')
  @RequirePermission('commission-policy', 'edit')
  async updatePlan(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.updatePlan(id, body, await this.actor(req)), message: 'Commission plan updated' };
  }

  @Delete('plans/:id')
  @RequirePermission('commission-policy', 'delete')
  async removePlan(@Param('id') id: string, @Req() req: any) {
    return this.service.removePlan(id, await this.actor(req));
  }

  @Post('simulate')
  @RequirePermission('commission-policy', 'view')
  async simulate(@Body() body: any) {
    return { success: true, data: await this.service.simulate(body) };
  }

  @Get('entries')
  @RequirePermission('commissions', 'view')
  async sheet(@Query() query: any, @Req() req: any) {
    return { success: true, data: await this.service.sheet(query, await this.actor(req)) };
  }

  @Put('entries')
  @RequirePermission('commissions', 'add')
  async save(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.saveEntry(body, await this.actor(req)), message: 'Commission saved' };
  }

  @Post('entries/status')
  @RequirePermission('commissions', 'edit')
  async status(@Body() body: any, @Req() req: any) {
    const data = await this.service.setStatus(body, await this.actor(req));
    return { success: true, data, message: data.message };
  }

  @Delete('entries/:id')
  @RequirePermission('commissions', 'delete')
  async removeEntry(@Param('id') id: string, @Req() req: any) {
    return this.service.removeEntry(id, await this.actor(req));
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AllowanceRule.name, schema: AllowanceRuleSchema },
      { name: CommissionPlan.name, schema: CommissionPlanSchema },
      { name: CommissionEntry.name, schema: CommissionEntrySchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: PayrollRun.name, schema: PayrollRunSchema },
    ]),
  ],
  controllers: [AllowanceRuleController, CommissionController],
  providers: [AllowanceRuleService, CommissionService],
})
export class PayrollPolicyModule {}
