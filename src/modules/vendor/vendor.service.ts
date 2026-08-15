import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor, VendorDocument } from './schemas/vendor.schema';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorService {
  constructor(@InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>) {}

  async findAll() {
    return this.vendorModel.find();
  }

  async findPaginated(query: Record<string, any>) {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const [result, totalVendors] = await Promise.all([
      this.vendorModel.find().skip(skip).limit(limit).exec(),
      this.vendorModel.countDocuments(),
    ]);

    const totalPages = Math.ceil(totalVendors / limit);

    return {
      data: result,
      currentPage: page,
      totalPages,
      totalItems: totalVendors,
      pageSize: limit,
    };
  }

  async findById(id: string) {
    const result = await this.vendorModel.findById(id);
    if (!result) {
      throw new NotFoundException('Vendor not found');
    }
    return result;
  }

  async create(dto: CreateVendorDto) {
    return this.vendorModel.create(dto);
  }

  async update(id: string, dto: UpdateVendorDto) {
    const result = await this.vendorModel.findByIdAndUpdate(id, dto, { new: true });
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
