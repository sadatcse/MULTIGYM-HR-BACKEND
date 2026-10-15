import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AssetTransactionService } from './asset-transaction.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('asset-transaction')
@UseGuards(JwtAuthGuard)
export class AssetTransactionController {
  constructor(private readonly transactionService: AssetTransactionService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('assets', 'view')
  async findAll(
    @Query('assetCode') assetCode?: string,
    @Query('employeeCode') employeeCode?: string,
    @Query('employeeName') employeeName?: string,
    @Query('transactionType') transactionType?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return await this.transactionService.findAll({
      assetCode,
      employeeCode,
      employeeName,
      transactionType,
      search,
      startDate,
      endDate,
      page,
      limit,
    });
  }
}
