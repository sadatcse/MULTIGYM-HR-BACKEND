import { Body, Controller, Delete, Get, Module, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { EmployeeHistory, EmployeeHistorySchema } from './schemas/employee-history.schema';
import { EmployeeHistoryService } from './employee-history.service';
import { HrAccessService } from '../hr-config/hr-access.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('employee-history')
@UseGuards(JwtAuthGuard)
export class EmployeeHistoryController {
  constructor(
    private readonly service: EmployeeHistoryService,
    private readonly access: HrAccessService,
  ) {}

  @Get('my')
  async my(@Req() req: any) {
    const actor = await this.access.getActor(req.user);
    return { success: true, data: await this.service.timeline(actor.id, actor) };
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('employee-history', 'view')
  async list(@Query() query: any, @Req() req: any) {
    const actor = await this.access.getActor(req.user);
    return { success: true, ...(await this.service.list(query, actor)) };
  }

  @Get('employee/:id')
  async timeline(@Param('id') id: string, @Req() req: any) {
    const actor = await this.access.getActor(req.user);
    return { success: true, data: await this.service.timeline(id, actor) };
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('employee-history', 'add')
  async create(@Body() body: any, @Req() req: any) {
    const actor = await this.access.getActor(req.user);
    const data = await this.service.createManual(body, actor);
    return { success: true, data, message: 'History event recorded' };
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('employee-history', 'delete')
  async remove(@Param('id') id: string, @Req() req: any) {
    const actor = await this.access.getActor(req.user);
    return this.service.remove(id, actor);
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmployeeHistory.name, schema: EmployeeHistorySchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
  ],
  controllers: [EmployeeHistoryController],
  providers: [EmployeeHistoryService],
  exports: [EmployeeHistoryService],
})
export class EmployeeHistoryModule {}
