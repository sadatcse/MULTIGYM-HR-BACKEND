import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { VendorService } from './vendor.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('vendor')
@UseGuards(JwtAuthGuard)
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get()
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.vendorService.findAll(query);
    return { statusCode: HttpStatus.OK, message: 'Vendors retrieved successfully', ...result };
  }

  @Get('get-id/:id')
  async findById(@Param('id') id: string) {
    const data = await this.vendorService.findById(id);
    return { statusCode: HttpStatus.OK, message: 'Vendor retrieved successfully', data };
  }

  @Post('post')
  async create(@Body() dto: CreateVendorDto) {
    const data = await this.vendorService.create(dto);
    return { statusCode: HttpStatus.CREATED, message: 'Vendor created successfully', data };
  }

  @Put('update/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    const data = await this.vendorService.update(id, dto);
    return { statusCode: HttpStatus.OK, message: 'Vendor updated successfully', data };
  }

  @Delete('delete/:id')
  async remove(@Param('id') id: string) {
    return this.vendorService.remove(id);
  }
}
