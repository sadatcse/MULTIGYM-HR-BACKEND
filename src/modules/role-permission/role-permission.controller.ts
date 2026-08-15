import { Controller, Get, Post, Delete, Body, Query } from '@nestjs/common';
import { RolePermissionService } from './role-permission.service';
import { CreateRolePermissionDto } from './dto/create-role-permission.dto';

@Controller('role-permission')
export class RolePermissionController {
  constructor(private readonly service: RolePermissionService) {}

  @Post()
  async createOrUpdate(@Body() dto: CreateRolePermissionDto) {
    const data = await this.service.createOrUpdate(dto);
    return { success: true, message: 'Permissions saved successfully', data };
  }

  @Get()
  async findOne(@Query('role') role: string) {
    const data = await this.service.findOne(role);
    return { success: true, data };
  }

  @Get('all')
  async findAll() {
    const data = await this.service.findAll();
    return { success: true, count: data.length, data };
  }

  @Delete()
  async remove(@Body('role') role: string) {
    return this.service.remove(role);
  }
}
