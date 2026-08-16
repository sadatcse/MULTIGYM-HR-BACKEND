import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProxyDuty, ProxyDutyDocument } from './schemas/proxy-duty.schema';
import { CreateProxyDutyDto } from './dto/create-proxy-duty.dto';
import { UpdateProxyDutyDto } from './dto/update-proxy-duty.dto';

@Injectable()
export class ProxyDutyService {
  constructor(
    @InjectModel(ProxyDuty.name)
    private readonly proxyDutyModel: Model<ProxyDutyDocument>,
  ) {}

  async create(createDto: CreateProxyDutyDto) {
    const newDoc = new this.proxyDutyModel(createDto);
    return newDoc.save();
  }

  async findAll(search?: string, status?: string, page?: number, limit?: number) {
    const filter: any = {};
    if (search && search.trim()) {
      filter.$or = [
        { originalEmployeeName: { $regex: search.trim(), $options: 'i' } },
        { proxyEmployeeName: { $regex: search.trim(), $options: 'i' } },
        { remarks: { $regex: search.trim(), $options: 'i' } },
      ];
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const total = await this.proxyDutyModel.countDocuments(filter);
    let query = this.proxyDutyModel.find(filter).sort({ dutyDate: -1, createdAt: -1 });

    if (page && limit) {
      query = query.skip((page - 1) * limit).limit(limit);
    }

    const data = await query.exec();
    const totalPages = limit ? Math.ceil(total / limit) || 1 : 1;

    const totalRecords = await this.proxyDutyModel.countDocuments();
    const activeCount = await this.proxyDutyModel.countDocuments({ status: 'active' });

    return {
      data,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages,
      stats: {
        totalRecords,
        activeCount,
      },
    };
  }

  async findOne(id: string) {
    const doc = await this.proxyDutyModel.findById(id);
    if (!doc) throw new NotFoundException(`Proxy duty record not found`);
    return doc;
  }

  async update(id: string, updateDto: UpdateProxyDutyDto) {
    const doc = await this.proxyDutyModel.findById(id);
    if (!doc) throw new NotFoundException(`Proxy duty record not found`);
    return this.proxyDutyModel.findByIdAndUpdate(id, updateDto, { new: true });
  }

  async remove(id: string) {
    const deleted = await this.proxyDutyModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException(`Proxy duty record not found`);
    return { message: 'Proxy duty record deleted successfully' };
  }
}
