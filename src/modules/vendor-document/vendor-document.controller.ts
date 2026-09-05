import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { VendorDocumentService } from './vendor-document.service';
import { CreateVendorDocumentDto } from './dto/create-vendor-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

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
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'add')
  async create(@Body() dto: CreateVendorDocumentDto) {
    const data = await this.vendorDocumentService.create(dto);
    return { statusCode: HttpStatus.CREATED, message: 'Document saved successfully', data };
  }

  @Delete('delete/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('vendor-details', 'delete')
  async remove(@Param('id') id: string) {
    return this.vendorDocumentService.remove(id);
  }
}
