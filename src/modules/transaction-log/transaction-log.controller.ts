import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { TransactionLogService } from './transaction-log.service';
import { CreateTransactionLogDto } from './dto/create-transaction-log.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('transaction-logs')
@UseGuards(JwtAuthGuard)
export class TransactionLogController {
  constructor(private readonly transactionLogService: TransactionLogService) {}

  @Get()
  findPaginated(@Query() query: Record<string, any>) {
    return this.transactionLogService.findPaginated(query);
  }

  @Get('get-id/:id')
  findById(@Param('id') id: string) {
    return this.transactionLogService.findById(id);
  }

  @Post('create')
  create(@Body() dto: CreateTransactionLogDto) {
    return this.transactionLogService.create(dto);
  }

  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.transactionLogService.remove(id);
  }
}
