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
} from '@nestjs/common';
import { ProxyDutyService } from './proxy-duty.service';
import { CreateProxyDutyDto } from './dto/create-proxy-duty.dto';
import { UpdateProxyDutyDto } from './dto/update-proxy-duty.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('proxy-duty')
@UseGuards(JwtAuthGuard)
export class ProxyDutyController {
  constructor(private readonly proxyDutyService: ProxyDutyService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('proxy-duty', 'add')
  create(@Body() createDto: CreateProxyDutyDto) {
    return this.proxyDutyService.create(createDto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('month') month?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.proxyDutyService.findAll(
      search,
      status,
      month,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.proxyDutyService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('proxy-duty', 'edit')
  update(@Param('id') id: string, @Body() updateDto: UpdateProxyDutyDto) {
    return this.proxyDutyService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('proxy-duty', 'delete')
  remove(@Param('id') id: string) {
    return this.proxyDutyService.remove(id);
  }
}
