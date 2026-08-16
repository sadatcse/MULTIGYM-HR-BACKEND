import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branch')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Post()
  async create(@Body() createBranchDto: CreateBranchDto) {
    const data = await this.branchService.create(createBranchDto);
    return { success: true, message: 'Branch created successfully', data };
  }

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 5;

    const result = await this.branchService.findAll(search, status, pageNum, limitNum);
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

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.branchService.findOne(id);
    return { success: true, data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateBranchDto: UpdateBranchDto) {
    console.log('BranchController update body:', JSON.stringify(updateBranchDto));
    const data = await this.branchService.update(id, updateBranchDto);
    return { success: true, message: 'Branch updated successfully', data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.branchService.remove(id);
  }
}
