import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { VendorPurchaseService } from './vendor-purchase.service';
import { CreateVendorPurchaseDto } from './dto/create-vendor-purchase.dto';
import { UpdateVendorPurchaseDto } from './dto/update-vendor-purchase.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('vendor-purchase')
@UseGuards(JwtAuthGuard)
export class VendorPurchaseController {
  constructor(private readonly purchaseService: VendorPurchaseService) {}

  @Get()
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.purchaseService.findAll(query);
    return { statusCode: HttpStatus.OK, message: 'Purchases retrieved successfully', ...result };
  }

  @Get('expiring-warranties')
  async expiringWarranties(@Query('vendor') vendor?: string) {
    const data = await this.purchaseService.findExpiringWarranties(vendor);
    return { statusCode: HttpStatus.OK, message: 'Expiring warranties retrieved successfully', data };
  }

  @Get('pending-payments')
  async pendingPayments(@Query('vendor') vendor?: string) {
    const data = await this.purchaseService.findPendingPayments(vendor);
    return { statusCode: HttpStatus.OK, message: 'Pending payments retrieved successfully', data };
  }

  @Get('get-id/:id')
  async findById(@Param('id') id: string) {
    const data = await this.purchaseService.findById(id);
    return { statusCode: HttpStatus.OK, message: 'Purchase record retrieved successfully', data };
  }

  @Post('post')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'add')
  async create(@Body() dto: CreateVendorPurchaseDto) {
    const data = await this.purchaseService.create(dto);
    return { statusCode: HttpStatus.CREATED, message: 'Purchase recorded successfully', data };
  }

  @Put('update/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'edit')
  async update(@Param('id') id: string, @Body() dto: UpdateVendorPurchaseDto) {
    const data = await this.purchaseService.update(id, dto);
    return { statusCode: HttpStatus.OK, message: 'Purchase record updated successfully', data };
  }

  @Delete('delete/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'delete')
  async remove(@Param('id') id: string) {
    return this.purchaseService.remove(id);
  }

  @Post('payment/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'edit')
  async addPayment(@Param('id') id: string, @Body() dto: AddPaymentDto) {
    const data = await this.purchaseService.addPayment(id, dto);
    return { statusCode: HttpStatus.OK, message: 'Payment recorded successfully', data };
  }

  @Delete('payment/:id/:paymentId')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'delete')
  async removePayment(@Param('id') id: string, @Param('paymentId') paymentId: string) {
    const data = await this.purchaseService.removePayment(id, paymentId);
    return { statusCode: HttpStatus.OK, message: 'Payment entry removed successfully', data };
  }
}
