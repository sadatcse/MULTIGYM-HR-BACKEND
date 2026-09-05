import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ManagementPersonService } from './management-person.service';
import { CreateManagementPersonDto } from './dto/create-management-person.dto';
import { UpdateManagementPersonDto } from './dto/update-management-person.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('management-person')
@UseGuards(JwtAuthGuard)
export class ManagementPersonController {
  constructor(private readonly managementPersonService: ManagementPersonService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('management-persons', 'add')
  async create(@Body() createDto: CreateManagementPersonDto, @Req() req: any) {
    const userId = req.user?.id || req.user?._id;
    const data = await this.managementPersonService.create(createDto, userId);
    return {
      success: true,
      message: 'Management authority created successfully',
      data,
    };
  }

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const result = await this.managementPersonService.findAll(search, status, pageNum, limitNum);
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

  @Get('active')
  async findAllActive() {
    const data = await this.managementPersonService.findAllActive();
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.managementPersonService.findOne(id);
    return {
      success: true,
      data,
    };
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('management-persons', 'edit')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateManagementPersonDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?._id;
    const data = await this.managementPersonService.update(id, updateDto, userId);
    return {
      success: true,
      message: 'Management authority updated successfully',
      data,
    };
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('management-persons', 'delete')
  async remove(@Param('id') id: string) {
    await this.managementPersonService.remove(id);
    return {
      success: true,
      message: 'Management authority deleted successfully',
    };
  }
}
