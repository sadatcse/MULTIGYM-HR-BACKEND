import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { VendorPerformanceService } from './vendor-performance.service';
import { CreateVendorPerformanceDto } from './dto/create-vendor-performance.dto';
import { UpdateVendorPerformanceDto } from './dto/update-vendor-performance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('vendor-performance')
@UseGuards(JwtAuthGuard)
export class VendorPerformanceController {
  constructor(private readonly performanceService: VendorPerformanceService) {}

  @Get()
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.performanceService.findAll(query);
    return { statusCode: HttpStatus.OK, message: 'Performance reviews retrieved successfully', ...result };
  }

  @Post('post')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'add')
  async create(@Body() dto: CreateVendorPerformanceDto) {
    const data = await this.performanceService.create(dto);
    return { statusCode: HttpStatus.CREATED, message: 'Performance review recorded successfully', data };
  }

  @Put('update/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'edit')
  async update(@Param('id') id: string, @Body() dto: UpdateVendorPerformanceDto) {
    const data = await this.performanceService.update(id, dto);
    return { statusCode: HttpStatus.OK, message: 'Performance review updated successfully', data };
  }

  @Delete('delete/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'delete')
  async remove(@Param('id') id: string) {
    return this.performanceService.remove(id);
  }
}
