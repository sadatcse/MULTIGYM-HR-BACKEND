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
import { BonusPolicyService } from './bonus-policy.service';
import { CreateBonusPolicyDto } from './dto/create-bonus-policy.dto';
import { UpdateBonusPolicyDto } from './dto/update-bonus-policy.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('bonus-policy')
@UseGuards(JwtAuthGuard)
export class BonusPolicyController {
  constructor(private readonly bonusPolicyService: BonusPolicyService) {}

  @Post()
  create(@Body() createDto: CreateBonusPolicyDto) {
    return this.bonusPolicyService.create(createDto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bonusPolicyService.findAll(
      search,
      status,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bonusPolicyService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateBonusPolicyDto) {
    return this.bonusPolicyService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bonusPolicyService.remove(id);
  }
}
