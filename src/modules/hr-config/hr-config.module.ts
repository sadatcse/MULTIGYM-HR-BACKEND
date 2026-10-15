import { Body, Controller, Get, Global, Module, Post, Put, Req, UseGuards } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { HrConfig, HrConfigSchema } from './schemas/hr-config.schema';
import { HrAccessService } from './hr-access.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('hr-config')
@UseGuards(JwtAuthGuard)
export class HrConfigController {
  constructor(private readonly access: HrAccessService) {}

  // Every signed-in client needs the stage/scope wiring to decide which
  // approval buttons to show, so reads are open to any authenticated user —
  // except the device key, which only management sees.
  @Get()
  async get(@Req() req: any) {
    const actor = await this.access.getActor(req.user);
    const cfg = await this.access.getConfig();
    const data: any = { ...cfg };
    if (actor.scope !== 'all') delete data.deviceApiKey;
    return {
      success: true,
      data,
      me: { id: actor.id, name: actor.name, role: actor.role, scope: actor.scope, branches: actor.branches, isSuperAdmin: actor.isSuperAdmin },
    };
  }

  @Put()
  @UseGuards(PermissionsGuard)
  @RequirePermission('hr-workflow-config', 'edit')
  async update(@Body() body: any, @Req() req: any) {
    const actor = await this.access.getActor(req.user);
    const data = await this.access.updateConfig(body, actor);
    return { success: true, data, message: 'HR workflow settings saved' };
  }

  @Post('rotate-device-key')
  @UseGuards(PermissionsGuard)
  @RequirePermission('hr-workflow-config', 'edit')
  async rotate(@Req() req: any) {
    const actor = await this.access.getActor(req.user);
    if (actor.scope !== 'all') return { success: false, message: 'Not allowed' };
    return { success: true, data: await this.access.rotateDeviceKey() };
  }
}

// Global so every HR feature module can inject HrAccessService for actor
// resolution and branch/self data scoping without importing this module.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HrConfig.name, schema: HrConfigSchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
  ],
  controllers: [HrConfigController],
  providers: [HrAccessService],
  exports: [HrAccessService],
})
export class HrConfigModule {}
