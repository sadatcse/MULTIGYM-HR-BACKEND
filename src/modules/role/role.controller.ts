import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  async create(@Body() createRoleDto: CreateRoleDto) {
    const data = await this.roleService.create(createRoleDto);
    return { success: true, message: 'User role created successfully', data };
  }

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 5;

    const result = await this.roleService.findAll(search, status, pageNum, limitNum);
    return {
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      stats: result.stats,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.roleService.findOne(id);
    return { success: true, data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    const data = await this.roleService.update(id, updateRoleDto);
    return { success: true, message: 'User role updated successfully', data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.roleService.remove(id);
  }
}
