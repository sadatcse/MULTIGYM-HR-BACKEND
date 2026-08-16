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
import { OvertimeService } from './overtime.service';
import { CreateOvertimePolicyDto } from './dto/create-overtime-policy.dto';
import { CreateOvertimeRecordDto } from './dto/create-overtime-record.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('overtime')
@UseGuards(JwtAuthGuard)
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  // Policies
  @Post('policy')
  createPolicy(@Body() dto: CreateOvertimePolicyDto) {
    return this.overtimeService.createPolicy(dto);
  }

  @Get('policy')
  findAllPolicies(@Query('search') search?: string, @Query('status') status?: string) {
    return this.overtimeService.findAllPolicies(search, status);
  }

  @Patch('policy/:id')
  updatePolicy(@Param('id') id: string, @Body() dto: Partial<CreateOvertimePolicyDto>) {
    return this.overtimeService.updatePolicy(id, dto);
  }

  @Delete('policy/:id')
  removePolicy(@Param('id') id: string) {
    return this.overtimeService.removePolicy(id);
  }

  // Records
  @Post('record')
  createRecord(@Body() dto: CreateOvertimeRecordDto) {
    return this.overtimeService.createRecord(dto);
  }

  @Get('record')
  findAllRecords(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.overtimeService.findAllRecords(
      search,
      status,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Patch('record/:id')
  updateRecord(@Param('id') id: string, @Body() dto: Partial<CreateOvertimeRecordDto>) {
    return this.overtimeService.updateRecord(id, dto);
  }

  @Delete('record/:id')
  removeRecord(@Param('id') id: string) {
    return this.overtimeService.removeRecord(id);
  }
}
