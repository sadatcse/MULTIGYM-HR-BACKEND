import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { VendorServiceRecordService } from './vendor-service.service';
import { CreateVendorServiceRecordDto } from './dto/create-vendor-service-record.dto';
import { UpdateVendorServiceRecordDto } from './dto/update-vendor-service-record.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

import { AddPaymentDto } from '../vendor-purchase/dto/add-payment.dto';

@Controller('vendor-service')
@UseGuards(JwtAuthGuard)
export class VendorServiceRecordController {
  constructor(private readonly serviceRecordService: VendorServiceRecordService) {}

  @Get()
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.serviceRecordService.findAll(query);
    return { statusCode: HttpStatus.OK, message: 'Service records retrieved successfully', ...result };
  }

  @Get('upcoming')
  async upcoming(@Query('days') days?: string, @Query('vendor') vendor?: string) {
    const data = await this.serviceRecordService.findUpcoming(days ? parseInt(days, 10) : 30, vendor);
    return { statusCode: HttpStatus.OK, message: 'Upcoming services retrieved successfully', data };
  }

  @Get('get-id/:id')
  async findById(@Param('id') id: string) {
    const data = await this.serviceRecordService.findById(id);
    return { statusCode: HttpStatus.OK, message: 'Service record retrieved successfully', data };
  }

  @Post('post')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'add')
  async create(@Body() dto: CreateVendorServiceRecordDto) {
    const data = await this.serviceRecordService.create(dto);
    return { statusCode: HttpStatus.CREATED, message: 'Service record created successfully', data };
  }

  @Put('update/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'edit')
  async update(@Param('id') id: string, @Body() dto: UpdateVendorServiceRecordDto) {
    const data = await this.serviceRecordService.update(id, dto);
    return { statusCode: HttpStatus.OK, message: 'Service record updated successfully', data };
  }

  @Delete('delete/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'delete')
  async remove(@Param('id') id: string) {
    return this.serviceRecordService.remove(id);
  }

  @Post('payment/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'edit')
  async addPayment(@Param('id') id: string, @Body() dto: AddPaymentDto) {
    const data = await this.serviceRecordService.addPayment(id, dto);
    return { statusCode: HttpStatus.OK, message: 'Payment recorded successfully', data };
  }

  @Delete('payment/:id/:paymentId')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'delete')
  async removePayment(@Param('id') id: string, @Param('paymentId') paymentId: string) {
    const data = await this.serviceRecordService.removePayment(id, paymentId);
    return { statusCode: HttpStatus.OK, message: 'Payment removed successfully', data };
  }
}
