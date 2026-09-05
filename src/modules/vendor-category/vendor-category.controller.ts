import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { VendorCategoryService } from './vendor-category.service';
import { CreateVendorCategoryDto } from './dto/create-vendor-category.dto';
import { UpdateVendorCategoryDto } from './dto/update-vendor-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('vendor-category')
@UseGuards(JwtAuthGuard)
export class VendorCategoryController {
  constructor(private readonly vendorCategoryService: VendorCategoryService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-categories', 'add')
  async create(@Body() createDto: CreateVendorCategoryDto) {
    const data = await this.vendorCategoryService.create(createDto);
    return { statusCode: HttpStatus.CREATED, message: 'Vendor category created successfully', data };
  }

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const result = await this.vendorCategoryService.findAll(search, status, pageNum, limitNum);
    return {
      statusCode: HttpStatus.OK,
      message: 'Vendor categories retrieved successfully',
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
    const data = await this.vendorCategoryService.findOne(id);
    return { statusCode: HttpStatus.OK, message: 'Vendor category retrieved successfully', data };
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-categories', 'edit')
  async update(@Param('id') id: string, @Body() updateDto: UpdateVendorCategoryDto) {
    const data = await this.vendorCategoryService.update(id, updateDto);
    return { statusCode: HttpStatus.OK, message: 'Vendor category updated successfully', data };
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-categories', 'delete')
  async remove(@Param('id') id: string) {
    return this.vendorCategoryService.remove(id);
  }
}
