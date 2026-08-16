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
import { LatePolicyService } from './late-policy.service';
import { CreateLatePolicyDto } from './dto/create-late-policy.dto';
import { UpdateLatePolicyDto } from './dto/update-late-policy.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('late-policy')
@UseGuards(JwtAuthGuard)
export class LatePolicyController {
  constructor(private readonly latePolicyService: LatePolicyService) {}

  @Post()
  create(@Body() createDto: CreateLatePolicyDto) {
    return this.latePolicyService.create(createDto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.latePolicyService.findAll(
      search,
      status,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.latePolicyService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateLatePolicyDto) {
    return this.latePolicyService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.latePolicyService.remove(id);
  }
}
