import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { VendorService } from './vendor.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Controller('vendor')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  // Get all vendors
  @Get()
  findAll() {
    return this.vendorService.findAll();
  }

  // Get vendor by ID
  @Get('get-id/:id')
  findById(@Param('id') id: string) {
    return this.vendorService.findById(id);
  }

  // Create a new vendor
  @Post('post')
  create(@Body() dto: CreateVendorDto) {
    return this.vendorService.create(dto);
  }

  // Update a vendor by ID
  @Put('update/:id')
  update(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    return this.vendorService.update(id, dto);
  }

  // Delete a vendor by ID
  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.vendorService.remove(id);
  }

  // Get paginated vendors
  @Get('paginate')
  findPaginated(@Query() query: Record<string, any>) {
    return this.vendorService.findPaginated(query);
  }
}
