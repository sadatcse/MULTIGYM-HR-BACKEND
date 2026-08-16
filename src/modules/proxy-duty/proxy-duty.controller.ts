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

@Controller('proxy-duty')
@UseGuards(JwtAuthGuard)
export class ProxyDutyController {
  constructor(private readonly proxyDutyService: ProxyDutyService) {}

  @Post()
  create(@Body() createDto: CreateProxyDutyDto) {
    return this.proxyDutyService.create(createDto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.proxyDutyService.findAll(
      search,
      status,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.proxyDutyService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateProxyDutyDto) {
    return this.proxyDutyService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.proxyDutyService.remove(id);
  }
}
