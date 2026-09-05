import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AssetTransaction, AssetTransactionDocument } from './schemas/asset-transaction.schema';

@Injectable()
export class AssetTransactionService {
  constructor(
    @InjectModel(AssetTransaction.name)
    private transactionModel: Model<AssetTransactionDocument>,
  ) {}

  async createTransaction(payload: Partial<AssetTransaction>): Promise<AssetTransactionDocument> {
    const count = await this.transactionModel.countDocuments();
    const transactionId = payload.transactionId || `TXN-AST-${Date.now()}-${(count + 1).toString().padStart(4, '0')}`;
    const txn = new this.transactionModel({
      ...payload,
      transactionId,
      date: payload.date || new Date(),
    });
    return await txn.save();
  }

  async findAll(query: {
    assetCode?: string;
    employeeCode?: string;
    employeeName?: string;
    transactionType?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};

    if (query.assetCode) filter.assetCode = query.assetCode;
    if (query.employeeCode) filter.employeeCode = query.employeeCode;
    if (query.transactionType && query.transactionType !== 'all') {
      filter.transactionType = query.transactionType;
    }

    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [
        { assetCode: regex },
        { assetName: regex },
        { employeeName: regex },
        { employeeCode: regex },
        { departmentName: regex },
        { branchName: regex },
        { notes: regex },
      ];
    }

    if (query.startDate || query.endDate) {
      filter.date = {};
      if (query.startDate) filter.date.$gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const page = query.page ? Math.max(1, Number(query.page)) : 1;
    const limit = query.limit ? Math.max(1, Math.min(100, Number(query.limit))) : 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.transactionModel.find(filter).sort({ date: -1 }).skip(skip).limit(limit).exec(),
      this.transactionModel.countDocuments(filter),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
