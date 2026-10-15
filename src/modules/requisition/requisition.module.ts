import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { Requisition, RequisitionSchema } from './schemas/requisition.schema';
import { RequisitionService } from './requisition.service';
import { HrAccessService } from '../hr-config/hr-access.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('requisitions')
@UseGuards(JwtAuthGuard)
export class RequisitionController {
  constructor(
    private readonly service: RequisitionService,
    private readonly access: HrAccessService,
  ) {}

  private actor(req: any) {
    return this.access.getActor(req.user);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('requisitions', 'view')
  async list(@Query() query: any, @Req() req: any) {
    return { success: true, ...(await this.service.list(query, await this.actor(req))) };
  }

  // Requisitions raised by the signed-in employee (self-service).
  @Get('my')
  async my(@Query() query: any, @Req() req: any) {
    const actor = await this.actor(req);
    return { success: true, ...(await this.service.list({ ...query, mine: 'true' }, actor)) };
  }

  @Get('pending-for-me')
  async pending(@Req() req: any) {
    return { success: true, data: await this.service.pendingForMe(await this.actor(req)) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return { success: true, data: await this.service.findOne(id, await this.actor(req)) };
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('requisition-create', 'add')
  async create(@Body() body: any, @Req() req: any) {
    const data = await this.service.create(body, await this.actor(req));
    return { success: true, data, message: `Requisition ${data.requisitionNo} submitted` };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.update(id, body, await this.actor(req)), message: 'Requisition updated' };
  }

  @Post(':id/quotations')
  async addQuotation(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.addQuotation(id, body, await this.actor(req)), message: 'Quotation added' };
  }

  @Delete(':id/quotations/:quotationId')
  async removeQuotation(@Param('id') id: string, @Param('quotationId') qid: string, @Req() req: any) {
    return { success: true, data: await this.service.removeQuotation(id, qid, await this.actor(req)) };
  }

  @Post(':id/action')
  async act(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.act(id, body, await this.actor(req)), message: 'Requisition updated' };
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Requisition.name, schema: RequisitionSchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
  ],
  controllers: [RequisitionController],
  providers: [RequisitionService],
})
export class RequisitionModule {}
