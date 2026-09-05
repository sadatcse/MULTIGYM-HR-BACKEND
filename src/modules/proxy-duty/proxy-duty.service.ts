import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProxyDuty, ProxyDutyDocument } from './schemas/proxy-duty.schema';
import { CreateProxyDutyDto } from './dto/create-proxy-duty.dto';
import { UpdateProxyDutyDto } from './dto/update-proxy-duty.dto';
import { BaseCrudService } from '../../common/services/base-crud.service';

@Injectable()
export class ProxyDutyService extends BaseCrudService<ProxyDutyDocument> {
  constructor(
    @InjectModel(ProxyDuty.name)
    private readonly proxyDutyModel: Model<ProxyDutyDocument>,
  ) {
    super(proxyDutyModel);
  }

  async create(createDto: CreateProxyDutyDto) {
    const newDoc = new this.proxyDutyModel(createDto);
    return newDoc.save();
  }

  async findAll(search?: string, status?: string, month?: string, page?: number, limit?: number) {
    const { data, total, page: pageOut, limit: limitOut, totalPages } = await this.findAllBase({
      search,
      searchFields: ['originalEmployeeName', 'proxyEmployeeName', 'remarks'],
      status,
      page,
      limit,
      sort: { dutyDate: -1, createdAt: -1 },
      extraFilter: month && month.trim() ? { dutyDate: { $regex: `^${month.trim()}` } } : undefined,
    });

    const totalRecords = await this.proxyDutyModel.countDocuments();
    const activeCount = await this.proxyDutyModel.countDocuments({ status: 'active' });

    return {
      data,
      total,
      page: pageOut,
      limit: limitOut,
      totalPages,
      stats: {
        totalRecords,
        activeCount,
      },
    };
  }

  async findOne(id: string) {
    return this.findOneBase(id, 'Proxy duty record');
  }

  async update(id: string, updateDto: UpdateProxyDutyDto) {
    const doc = await this.proxyDutyModel.findById(id);
    if (!doc) throw new NotFoundException(`Proxy duty record not found`);
    return this.proxyDutyModel.findByIdAndUpdate(id, updateDto, { new: true });
  }

  async remove(id: string) {
    return this.removeBase(id, 'Proxy duty record');
  }
}
