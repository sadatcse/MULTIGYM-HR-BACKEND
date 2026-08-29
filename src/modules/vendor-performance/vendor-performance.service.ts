import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VendorPerformance, VendorPerformanceDocument } from './schemas/vendor-performance.schema';
import { Vendor, VendorDocument } from '../vendor/schemas/vendor.schema';
import { CreateVendorPerformanceDto } from './dto/create-vendor-performance.dto';
import { UpdateVendorPerformanceDto } from './dto/update-vendor-performance.dto';

const RATING_FIELDS = ['serviceQuality', 'responseTime', 'productQuality', 'pricing', 'reliability'] as const;

@Injectable()
export class VendorPerformanceService {
  constructor(
    @InjectModel(VendorPerformance.name) private readonly performanceModel: Model<VendorPerformanceDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
  ) {}

  async create(dto: CreateVendorPerformanceDto) {
    const vendorExists = await this.vendorModel.exists({ _id: dto.vendor });
    if (!vendorExists) {
      throw new BadRequestException('Vendor not found');
    }
    // overallRating is computed by the schema's pre('save') hook.
    const created = new this.performanceModel(dto);
    return created.save();
  }

  async findAll(query: Record<string, any>) {
    const { vendor } = query;
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (vendor) filter.vendor = vendor;

    const [totalItems, data] = await Promise.all([
      this.performanceModel.countDocuments(filter),
      this.performanceModel.find(filter).sort({ reviewDate: -1 }).skip(skip).limit(limit),
    ]);

    return {
      data,
      total: totalItems,
      totalPages: Math.ceil(totalItems / limit) || 1,
      currentPage: page,
      pageSize: limit,
    };
  }

  async update(id: string, dto: UpdateVendorPerformanceDto) {
    const existing = await this.performanceModel.findById(id);
    if (!existing) {
      throw new NotFoundException('Performance review not found');
    }

    const merged = { ...existing.toObject(), ...dto };
    const overallRating =
      RATING_FIELDS.reduce((sum, field) => sum + (merged[field] as number), 0) / RATING_FIELDS.length;

    const result = await this.performanceModel.findByIdAndUpdate(
      id,
      { ...dto, overallRating },
      { new: true, runValidators: true },
    );
    if (!result) {
      throw new NotFoundException('Performance review not found');
    }
    return result;
  }

  async remove(id: string) {
    const result = await this.performanceModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Performance review not found');
    }
    return { message: 'Performance review deleted successfully' };
  }

  // Used by VendorService to attach a live-computed rating to vendor
  // records, rather than storing (and risking drift on) a cached average.
  async getAverageRatingMap(vendorIds: Types.ObjectId[] | string[]): Promise<Map<string, number>> {
    if (!vendorIds.length) return new Map();
    const results = await this.performanceModel.aggregate([
      { $match: { vendor: { $in: vendorIds.map((id) => new Types.ObjectId(id)) } } },
      { $group: { _id: '$vendor', avgRating: { $avg: '$overallRating' } } },
    ]);
    return new Map(results.map((r) => [r._id.toString(), Math.round(r.avgRating * 10) / 10]));
  }

  async getAverageRating(vendorId: string): Promise<number | null> {
    const map = await this.getAverageRatingMap([vendorId]);
    return map.get(vendorId) ?? null;
  }
}
