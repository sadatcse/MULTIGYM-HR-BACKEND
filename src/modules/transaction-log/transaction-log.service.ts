import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { TransactionLog, TransactionLogDocument } from './schemas/transaction-log.schema';
import { CreateTransactionLogDto } from './dto/create-transaction-log.dto';

const MAX_LIMIT = 100;

@Injectable()
export class TransactionLogService {
  constructor(
    @InjectModel(TransactionLog.name)
    private readonly transactionLogModel: Model<TransactionLogDocument>,
  ) {}

  // Build a Mongo filter from the shared set of query params every listing endpoint accepts
  private buildFilter(query: Record<string, any>) {
    const { status, transactionType, branch, userEmail, from, to, search } = query;
    const filter: Record<string, any> = {};

    if (status) filter.status = status;
    if (transactionType) filter.transactionType = transactionType.toUpperCase();
    if (branch) filter.branch = branch;
    if (userEmail) filter.userEmail = userEmail.toLowerCase();

    if (from || to) {
      filter.transactionTime = {};
      if (from) filter.transactionTime.$gte = new Date(from);
      if (to) filter.transactionTime.$lte = new Date(to);
    }

    if (search) {
      filter.$or = [
        { userEmail: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
        { Message: { $regex: search, $options: 'i' } },
      ];
    }

    return filter;
  }

  async findPaginated(query: Record<string, any>) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(query.limit, 10) || 10, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const filter = this.buildFilter(query);

    const [totalLogs, logs] = await Promise.all([
      this.transactionLogModel.countDocuments(filter),
      this.transactionLogModel
        .find(filter)
        .sort({ transactionTime: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return {
      data: logs,
      pagination: {
        totalItems: totalLogs,
        totalPages: Math.ceil(totalLogs / limit),
        currentPage: page,
        itemsPerPage: limit,
      },
    };
  }

  async findById(id: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid transaction log ID');
    }

    const log = await this.transactionLogModel.findById(id);
    if (!log) {
      throw new NotFoundException('Transaction log not found');
    }
    return log;
  }

  async create(dto: CreateTransactionLogDto) {
    return this.transactionLogModel.create(dto);
  }

  async remove(id: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid transaction log ID');
    }

    const deletedLog = await this.transactionLogModel.findByIdAndDelete(id);
    if (!deletedLog) {
      throw new NotFoundException('Transaction log not found');
    }
    return { message: 'Transaction log deleted successfully' };
  }
}
