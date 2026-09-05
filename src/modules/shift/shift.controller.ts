import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ShiftService } from './shift.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('shift')
@UseGuards(JwtAuthGuard)
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('shifts', 'add')
  async create(@Body() createDto: CreateShiftDto) {
    const data = await this.shiftService.create(createDto);
    return { success: true, message: 'Shift created successfully', data };
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

    const result = await this.shiftService.findAll(search, status, pageNum, limitNum);
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
    const data = await this.shiftService.findOne(id);
    return { success: true, data };
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('shifts', 'edit')
  async update(@Param('id') id: string, @Body() updateDto: UpdateShiftDto) {
    const data = await this.shiftService.update(id, updateDto);
    return { success: true, message: 'Shift updated successfully', data };
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('shifts', 'delete')
  async remove(@Param('id') id: string) {
    return this.shiftService.remove(id);
  }
}
