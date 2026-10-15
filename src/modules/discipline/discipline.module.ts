import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { DisciplinaryCase, DisciplinaryCaseSchema } from './schemas/disciplinary-case.schema';
import { DisciplineService } from './discipline.service';
import { EmployeeHistoryModule } from '../employee-history/employee-history.module';
import { HrAccessService } from '../hr-config/hr-access.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('discipline')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DisciplineController {
  constructor(
    private readonly service: DisciplineService,
    private readonly access: HrAccessService,
  ) {}

  private actor(req: any) {
    return this.access.getActor(req.user);
  }

  @Get()
  @RequirePermission('discipline', 'view')
  async list(@Query() query: any, @Req() req: any) {
    return { success: true, ...(await this.service.list(query, await this.actor(req))) };
  }

  @Get(':id')
  @RequirePermission('discipline', 'view')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return { success: true, data: await this.service.findOne(id, await this.actor(req)) };
  }

  @Post()
  @RequirePermission('discipline', 'add')
  async create(@Body() body: any, @Req() req: any) {
    const data = await this.service.create(body, await this.actor(req));
    return { success: true, data, message: `Case ${data.caseNo} opened` };
  }

  @Patch(':id')
  @RequirePermission('discipline', 'edit')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.update(id, body, await this.actor(req)), message: 'Case updated' };
  }

  @Post(':id/entries')
  @RequirePermission('discipline', 'edit')
  async addEntry(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.addEntry(id, body, await this.actor(req)), message: 'Entry added' };
  }

  @Post(':id/decision')
  @RequirePermission('discipline', 'edit')
  async decide(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.decide(id, body, await this.actor(req)), message: 'Decision recorded' };
  }

  @Post(':id/status')
  @RequirePermission('discipline', 'edit')
  async status(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.setStatus(id, body, await this.actor(req)), message: 'Status updated' };
  }

  @Delete(':id')
  @RequirePermission('discipline', 'delete')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, await this.actor(req));
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DisciplinaryCase.name, schema: DisciplinaryCaseSchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
    EmployeeHistoryModule,
  ],
  controllers: [DisciplineController],
  providers: [DisciplineService],
})
export class DisciplineModule {}
