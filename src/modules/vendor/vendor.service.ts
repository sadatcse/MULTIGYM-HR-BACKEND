import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor, VendorDocument } from './schemas/vendor.schema';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorService {
  constructor(@InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>) {}

  async create(dto: CreateVendorDto) {
    const existing = await this.vendorModel.findOne({
      name: { $regex: new RegExp(`^${dto.name.trim()}$`, 'i') },
    });
    if (existing) {
      throw new BadRequestException(`Vendor "${dto.name}" already exists.`);
    }
    return this.vendorModel.create(dto);
  }

  async findAll(query: Record<string, any>) {
    const { search, category, status } = query;
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { 'contactPerson1.name': { $regex: search, $options: 'i' } },
        { 'contactPerson1.phone': { $regex: search, $options: 'i' } },
        { taxVatNumber: { $regex: search, $options: 'i' } },
      ];
    }
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const [totalItems, data, totalVendors, activeVendors, inactiveVendors, categoryAgg] = await Promise.all([
      this.vendorModel.countDocuments(filter),
      this.vendorModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.vendorModel.countDocuments(),
      this.vendorModel.countDocuments({ status: 'active' }),
      this.vendorModel.countDocuments({ status: 'inactive' }),
      this.vendorModel.aggregate([
        { $match: { category: { $nin: [null, ''] } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      data,
      total: totalItems,
      totalPages,
      currentPage: page,
      pageSize: limit,
      stats: {
        totalVendors,
        activeVendors,
        inactiveVendors,
        categoriesInUse: categoryAgg.length,
      },
    };
  }

  async findById(id: string) {
    const result = await this.vendorModel.findById(id);
    if (!result) {
      throw new NotFoundException('Vendor not found');
    }
    return result;
  }

  async update(id: string, dto: UpdateVendorDto) {
    if (dto.name) {
      const existing = await this.vendorModel.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${dto.name.trim()}$`, 'i') },
      });
      if (existing) {
        throw new BadRequestException(`Vendor "${dto.name}" already exists.`);
      }
    }
    const result = await this.vendorModel.findByIdAndUpdate(id, dto, { new: true, runValidators: true });
    if (!result) {
      throw new NotFoundException('Vendor not found');
    }
    return result;
  }

  async remove(id: string) {
    const result = await this.vendorModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Vendor not found');
    }
    return { message: 'Vendor deleted successfully' };
  }
}
