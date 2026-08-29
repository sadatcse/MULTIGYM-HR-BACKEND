import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorServiceRecord, VendorServiceRecordDocument } from './schemas/vendor-service-record.schema';
import { Vendor, VendorDocument } from '../vendor/schemas/vendor.schema';
import { CreateVendorServiceRecordDto } from './dto/create-vendor-service-record.dto';
import { UpdateVendorServiceRecordDto } from './dto/update-vendor-service-record.dto';

@Injectable()
export class VendorServiceRecordService {
  constructor(
    @InjectModel(VendorServiceRecord.name) private readonly serviceModel: Model<VendorServiceRecordDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
  ) {}

  async create(dto: CreateVendorServiceRecordDto) {
    const vendorExists = await this.vendorModel.exists({ _id: dto.vendor });
    if (!vendorExists) {
      throw new BadRequestException('Vendor not found');
    }
    return this.serviceModel.create(dto);
  }

  async findAll(query: Record<string, any>) {
    const { vendor, search, completionStatus } = query;
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (vendor) filter.vendor = vendor;
    if (completionStatus && completionStatus !== 'all') filter.completionStatus = completionStatus;
    if (search) {
      filter.$or = [
        { serviceType: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { assignedTechnician: { $regex: search, $options: 'i' } },
        { serviceRequestRef: { $regex: search, $options: 'i' } },
      ];
    }

    const [totalItems, data] = await Promise.all([
      this.serviceModel.countDocuments(filter),
      this.serviceModel.find(filter).sort({ serviceDate: -1 }).skip(skip).limit(limit),
    ]);

    return {
      data,
      total: totalItems,
      totalPages: Math.ceil(totalItems / limit) || 1,
      currentPage: page,
      pageSize: limit,
    };
  }

  async findById(id: string) {
    const result = await this.serviceModel.findById(id);
    if (!result) {
      throw new NotFoundException('Service record not found');
    }
    return result;
  }

  async update(id: string, dto: UpdateVendorServiceRecordDto) {
    const result = await this.serviceModel.findByIdAndUpdate(id, dto, { new: true, runValidators: true });
    if (!result) {
      throw new NotFoundException('Service record not found');
    }
    return result;
  }

  async remove(id: string) {
    const result = await this.serviceModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Service record not found');
    }
    return { message: 'Service record deleted successfully' };
  }

  // Upcoming services within the next N days — used by the dashboard/alerts
  // endpoints (Phase 5).
  async findUpcoming(days = 30, vendorId?: string) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const filter: Record<string, any> = { nextServiceDate: { $gte: now, $lte: cutoff } };
    if (vendorId) filter.vendor = vendorId;

    return this.serviceModel.find(filter).populate('vendor', 'name category').sort({ nextServiceDate: 1 });
  }
}
