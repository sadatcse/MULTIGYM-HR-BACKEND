import { Controller, Get, Post, Delete, Body, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { RolePermissionService } from './role-permission.service';
import { CreateRolePermissionDto } from './dto/create-role-permission.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('role-permission')
@UseGuards(JwtAuthGuard)
export class RolePermissionController {
  constructor(private readonly service: RolePermissionService) {}

  // Write access is gated (previously open to any unauthenticated request,
  // which let anyone grant themselves full permissions on any role). The
  // service also enforces a hardcoded Super-Admin-only floor on top of this
  // configurable check — see RolePermissionService for why.
  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('role-permissions', 'edit')
  async createOrUpdate(@Body() dto: CreateRolePermissionDto, @Req() req: Request) {
    const data = await this.service.createOrUpdate(dto, (req as any).user?.role);
    return { success: true, message: 'Permissions saved successfully', data };
  }

  // Read access stays open to any authenticated user (not permission-gated):
  // every logged-in employee's own PermissionsProvider fetches their own
  // role's permission map here to build their menu/`can()` checks.
  @Get()
  async findOne(@Query('role') role: string) {
    const data = await this.service.findOne(role);
    return { success: true, data };
  }

  @Get('all')
  @UseGuards(PermissionsGuard)
  @RequirePermission('role-permissions', 'view')
  async findAll() {
    const data = await this.service.findAll();
    return { success: true, count: data.length, data };
  }

  @Delete()
  @UseGuards(PermissionsGuard)
  @RequirePermission('role-permissions', 'delete')
  async remove(@Body('role') role: string, @Req() req: Request) {
    return this.service.remove(role, (req as any).user?.role);
  }
}
