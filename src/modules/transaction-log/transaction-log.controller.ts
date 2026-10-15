import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { TransactionLogService } from './transaction-log.service';
import { CreateTransactionLogDto } from './dto/create-transaction-log.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequireScope, ScopeGuard } from '../../common/guards/scope.guard';

@Controller('transaction-logs')
@UseGuards(JwtAuthGuard)
export class TransactionLogController {
  constructor(private readonly transactionLogService: TransactionLogService) {}

  @Get()
  @UseGuards(ScopeGuard)
  @RequireScope('all')
  findPaginated(@Query() query: Record<string, any>) {
    return this.transactionLogService.findPaginated(query);
  }

  @Get('get-id/:id')
  @UseGuards(ScopeGuard)
  @RequireScope('all')
  findById(@Param('id') id: string) {
    return this.transactionLogService.findById(id);
  }

  @Post('create')
  @UseGuards(ScopeGuard)
  @RequireScope('superadmin')
  create(@Body() dto: CreateTransactionLogDto) {
    return this.transactionLogService.create(dto);
  }

  @Delete('delete/:id')
  @UseGuards(ScopeGuard)
  @RequireScope('superadmin')
  remove(@Param('id') id: string) {
    return this.transactionLogService.remove(id);
  }
}
