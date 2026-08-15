import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Controller('department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  async create(@Body() createDepartmentDto: CreateDepartmentDto) {
    const data = await this.departmentService.create(createDepartmentDto);
    return { success: true, message: 'Department created successfully', data };
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

    const result = await this.departmentService.findAll(search, status, pageNum, limitNum);
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
    const data = await this.departmentService.findOne(id);
    return { success: true, data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDepartmentDto: UpdateDepartmentDto) {
    const data = await this.departmentService.update(id, updateDepartmentDto);
    return { success: true, message: 'Department updated successfully', data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.departmentService.remove(id);
  }
}
