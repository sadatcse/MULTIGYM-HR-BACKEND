import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { JobPositionService } from './job-position.service';
import { CreateJobPositionDto } from './dto/create-job-position.dto';
import { UpdateJobPositionDto } from './dto/update-job-position.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('job-position')
@UseGuards(JwtAuthGuard)
export class JobPositionController {
  constructor(private readonly jobPositionService: JobPositionService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('job-positions', 'add')
  async create(@Body() createDto: CreateJobPositionDto) {
    const data = await this.jobPositionService.create(createDto);
    return { success: true, message: 'Job position created successfully', data };
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

    const result = await this.jobPositionService.findAll(search, status, pageNum, limitNum);
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
    const data = await this.jobPositionService.findOne(id);
    return { success: true, data };
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('job-positions', 'edit')
  async update(@Param('id') id: string, @Body() updateDto: UpdateJobPositionDto) {
    const data = await this.jobPositionService.update(id, updateDto);
    return { success: true, message: 'Job position updated successfully', data };
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('job-positions', 'delete')
  async remove(@Param('id') id: string) {
    return this.jobPositionService.remove(id);
  }
}
