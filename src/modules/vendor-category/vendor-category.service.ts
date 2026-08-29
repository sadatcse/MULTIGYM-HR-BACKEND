import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorCategory, VendorCategoryDocument } from './schemas/vendor-category.schema';
import { CreateVendorCategoryDto } from './dto/create-vendor-category.dto';
import { UpdateVendorCategoryDto } from './dto/update-vendor-category.dto';

@Injectable()
export class VendorCategoryService {
  constructor(
    @InjectModel(VendorCategory.name)
    private readonly vendorCategoryModel: Model<VendorCategoryDocument>,
  ) {}

  async create(createDto: CreateVendorCategoryDto) {
    const { title, order } = createDto;

    const existingTitle = await this.vendorCategoryModel.findOne({
      title: { $regex: new RegExp(`^${title.trim()}$`, 'i') },
    });
    if (existingTitle) {
      throw new BadRequestException(`Vendor category "${title}" already exists.`);
    }

    const existingOrder = await this.vendorCategoryModel.findOne({ order });
    if (existingOrder) {
      throw new BadRequestException(`Order number ${order} is already assigned to "${existingOrder.title}".`);
    }

    const created = new this.vendorCategoryModel(createDto);
    return created.save();
  }

  async findAll(search?: string, status?: string, page?: number, limit?: number) {
    const filter: any = {};
    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const total = await this.vendorCategoryModel.countDocuments(filter);

    let query = this.vendorCategoryModel.find(filter).sort({ order: 1, createdAt: -1 });
    if (page && limit) {
      const skip = (page - 1) * limit;
      query = query.skip(skip).limit(limit);
    }

    const data = await query.exec();
    const totalPages = limit ? Math.ceil(total / limit) || 1 : 1;

    const totalCategories = await this.vendorCategoryModel.countDocuments();
    const activeCategories = await this.vendorCategoryModel.countDocuments({ status: 'active' });
    const inactiveCategories = await this.vendorCategoryModel.countDocuments({ status: 'inactive' });
    const maxOrderDoc = await this.vendorCategoryModel.findOne().sort({ order: -1 }).select('order').exec();
    const maxDisplayOrder = maxOrderDoc ? maxOrderDoc.order : 0;

    return {
      data,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages,
      stats: { totalCategories, activeCategories, inactiveCategories, maxDisplayOrder },
    };
  }

  async findOne(id: string) {
    const category = await this.vendorCategoryModel.findById(id);
    if (!category) {
      throw new NotFoundException('Vendor category not found');
    }
    return category;
  }

  async update(id: string, updateDto: UpdateVendorCategoryDto) {
    const category = await this.vendorCategoryModel.findById(id);
    if (!category) {
      throw new NotFoundException('Vendor category not found');
    }

    if (updateDto.title && updateDto.title.trim().toLowerCase() !== category.title.toLowerCase()) {
      const existingTitle = await this.vendorCategoryModel.findOne({
        _id: { $ne: id },
        title: { $regex: new RegExp(`^${updateDto.title.trim()}$`, 'i') },
      });
      if (existingTitle) {
        throw new BadRequestException(`Vendor category "${updateDto.title}" already exists.`);
      }
    }

    if (updateDto.order && updateDto.order !== category.order) {
      const existingOrder = await this.vendorCategoryModel.findOne({
        _id: { $ne: id },
        order: updateDto.order,
      });
      if (existingOrder) {
        throw new BadRequestException(`Order number ${updateDto.order} is already assigned to "${existingOrder.title}".`);
      }
    }

    return this.vendorCategoryModel.findByIdAndUpdate(id, updateDto, { new: true, runValidators: true });
  }

  async remove(id: string) {
    const result = await this.vendorCategoryModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Vendor category not found');
    }
    return { message: 'Vendor category deleted successfully' };
  }
}
