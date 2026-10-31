import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AssetLocationService } from './asset-location.service';
import { CreateAssetLocationDto } from './dto/create-asset-location.dto';
import { UpdateAssetLocationDto } from './dto/update-asset-location.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('asset-location')
@UseGuards(JwtAuthGuard)
export class AssetLocationController {
  constructor(private readonly locationService: AssetLocationService) {}

  // Open to any signed-in user (like asset types): the Add Asset form lists these.
  @Get()
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.locationService.findAll(query);
    return { statusCode: HttpStatus.OK, message: 'Asset locations retrieved successfully', ...result };
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('asset-locations', 'add')
  async create(@Body() dto: CreateAssetLocationDto) {
    const data = await this.locationService.create(dto);
    return { statusCode: HttpStatus.CREATED, message: 'Location added', data };
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('asset-locations', 'edit')
  async update(@Param('id') id: string, @Body() dto: UpdateAssetLocationDto) {
    const data = await this.locationService.update(id, dto);
    return { statusCode: HttpStatus.OK, message: 'Location updated', data };
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('asset-locations', 'delete')
  async remove(@Param('id') id: string) {
    return this.locationService.remove(id);
  }
}
