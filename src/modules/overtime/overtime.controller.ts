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
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('overtime')
@UseGuards(JwtAuthGuard)
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  // Policies
  @Post('policy')
  @UseGuards(PermissionsGuard)
  @RequirePermission('overtime', 'add')
  createPolicy(@Body() dto: CreateOvertimePolicyDto) {
    return this.overtimeService.createPolicy(dto);
  }

  @Get('policy')
  findAllPolicies(@Query('search') search?: string, @Query('status') status?: string) {
    return this.overtimeService.findAllPolicies(search, status);
  }

  @Patch('policy/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('overtime', 'edit')
  updatePolicy(@Param('id') id: string, @Body() dto: Partial<CreateOvertimePolicyDto>) {
    return this.overtimeService.updatePolicy(id, dto);
  }

  @Delete('policy/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('overtime', 'delete')
  removePolicy(@Param('id') id: string) {
    return this.overtimeService.removePolicy(id);
  }

  // Records
  @Post('record')
  @UseGuards(PermissionsGuard)
  @RequirePermission('overtime', 'add')
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
  @UseGuards(PermissionsGuard)
  @RequirePermission('overtime', 'edit')
  updateRecord(@Param('id') id: string, @Body() dto: Partial<CreateOvertimeRecordDto>) {
    return this.overtimeService.updateRecord(id, dto);
  }

  @Delete('record/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('overtime', 'delete')
  removeRecord(@Param('id') id: string) {
    return this.overtimeService.removeRecord(id);
  }
}
