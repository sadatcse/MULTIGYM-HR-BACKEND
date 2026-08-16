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
import { AdvancePolicyService } from './advance-policy.service';
import { CreateAdvancePolicyDto } from './dto/create-advance-policy.dto';
import { UpdateAdvancePolicyDto } from './dto/update-advance-policy.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('advance-policy')
@UseGuards(JwtAuthGuard)
export class AdvancePolicyController {
  constructor(private readonly advancePolicyService: AdvancePolicyService) {}

  @Post()
  create(@Body() createDto: CreateAdvancePolicyDto) {
    return this.advancePolicyService.create(createDto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.advancePolicyService.findAll(
      search,
      status,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.advancePolicyService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateAdvancePolicyDto) {
    return this.advancePolicyService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.advancePolicyService.remove(id);
  }
}
