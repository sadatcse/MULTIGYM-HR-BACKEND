import { Controller, Get, Post, Body, Put, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ProductCategoryService } from './product-category.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('product-category')
@UseGuards(JwtAuthGuard)
export class ProductCategoryController {
  constructor(private readonly productCategoryService: ProductCategoryService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('product-categories', 'add')
  create(@Body() createDto: CreateProductCategoryDto) {
    return this.productCategoryService.create(createDto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.productCategoryService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      status,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productCategoryService.findOne(id);
  }

  @Put(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('product-categories', 'edit')
  update(@Param('id') id: string, @Body() updateDto: UpdateProductCategoryDto) {
    return this.productCategoryService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('product-categories', 'delete')
  remove(@Param('id') id: string) {
    return this.productCategoryService.remove(id);
  }
}
