import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AssetTypeService } from './asset-type.service';
import { CreateAssetTypeDto } from './dto/create-asset-type.dto';
import { UpdateAssetTypeDto } from './dto/update-asset-type.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('asset-type')
@UseGuards(JwtAuthGuard)
export class AssetTypeController {
  constructor(private readonly assetTypeService: AssetTypeService) {}

  @Post()
  async create(@Body() createDto: CreateAssetTypeDto) {
    const data = await this.assetTypeService.create(createDto);
    return { statusCode: HttpStatus.CREATED, message: 'Asset type created successfully', data };
  }

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const result = await this.assetTypeService.findAll(search, status, category, pageNum, limitNum);
    return {
      statusCode: HttpStatus.OK,
      message: 'Asset types retrieved successfully',
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
    const data = await this.assetTypeService.findOne(id);
    return { statusCode: HttpStatus.OK, message: 'Asset type retrieved successfully', data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateAssetTypeDto) {
    const data = await this.assetTypeService.update(id, updateDto);
    return { statusCode: HttpStatus.OK, message: 'Asset type updated successfully', data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.assetTypeService.remove(id);
  }
}
