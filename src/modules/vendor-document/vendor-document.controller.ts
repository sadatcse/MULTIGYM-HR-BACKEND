import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { VendorDocumentService } from './vendor-document.service';
import { CreateVendorDocumentDto } from './dto/create-vendor-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('vendor-document')
@UseGuards(JwtAuthGuard)
export class VendorDocumentController {
  constructor(private readonly vendorDocumentService: VendorDocumentService) {}

  @Get()
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.vendorDocumentService.findAll(query);
    return { statusCode: HttpStatus.OK, message: 'Documents retrieved successfully', ...result };
  }

  @Post('post')
  async create(@Body() dto: CreateVendorDocumentDto) {
    const data = await this.vendorDocumentService.create(dto);
    return { statusCode: HttpStatus.CREATED, message: 'Document saved successfully', data };
  }

  @Delete('delete/:id')
  async remove(@Param('id') id: string) {
    return this.vendorDocumentService.remove(id);
  }
}
