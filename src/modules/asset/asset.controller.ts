import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AssetService } from './asset.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('asset')
@UseGuards(JwtAuthGuard)
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get()
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.assetService.findAll(query);
    return { statusCode: HttpStatus.OK, message: 'Assets retrieved successfully', ...result };
  }

  @Get('get-id/:id')
  async findById(@Param('id') id: string) {
    const data = await this.assetService.findById(id);
    return { statusCode: HttpStatus.OK, message: 'Asset retrieved successfully', data };
  }

  @Post('post')
  @UseGuards(PermissionsGuard)
  @RequirePermission('assets', 'add')
  async create(@Body() dto: CreateAssetDto) {
    const data = await this.assetService.create(dto);
    return { statusCode: HttpStatus.CREATED, message: 'Asset created successfully', data };
  }

  @Put('update/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('assets', 'edit')
  async update(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    const data = await this.assetService.update(id, dto);
    return { statusCode: HttpStatus.OK, message: 'Asset updated successfully', data };
  }

  @Delete('delete/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('assets', 'delete')
  async remove(@Param('id') id: string) {
    return this.assetService.remove(id);
  }
}
