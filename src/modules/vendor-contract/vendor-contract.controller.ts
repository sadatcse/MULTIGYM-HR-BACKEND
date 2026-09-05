import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { VendorContractService } from './vendor-contract.service';
import { CreateVendorContractDto } from './dto/create-vendor-contract.dto';
import { UpdateVendorContractDto } from './dto/update-vendor-contract.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('vendor-contract')
@UseGuards(JwtAuthGuard)
export class VendorContractController {
  constructor(private readonly contractService: VendorContractService) {}

  @Get()
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.contractService.findAll(query);
    return { statusCode: HttpStatus.OK, message: 'Contracts retrieved successfully', ...result };
  }

  @Get('expiring')
  async expiring(@Query('vendor') vendor?: string) {
    const data = await this.contractService.findExpiring(vendor);
    return { statusCode: HttpStatus.OK, message: 'Expiring contracts retrieved successfully', data };
  }

  @Get('get-id/:id')
  async findById(@Param('id') id: string) {
    const data = await this.contractService.findById(id);
    return { statusCode: HttpStatus.OK, message: 'Contract retrieved successfully', data };
  }

  @Post('post')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'add')
  async create(@Body() dto: CreateVendorContractDto) {
    const data = await this.contractService.create(dto);
    return { statusCode: HttpStatus.CREATED, message: 'Contract created successfully', data };
  }

  @Put('update/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'edit')
  async update(@Param('id') id: string, @Body() dto: UpdateVendorContractDto) {
    const data = await this.contractService.update(id, dto);
    return { statusCode: HttpStatus.OK, message: 'Contract updated successfully', data };
  }

  @Delete('delete/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'delete')
  async remove(@Param('id') id: string) {
    return this.contractService.remove(id);
  }
}
