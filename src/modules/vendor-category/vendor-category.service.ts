import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorCategory, VendorCategoryDocument } from './schemas/vendor-category.schema';
import { CreateVendorCategoryDto } from './dto/create-vendor-category.dto';
import { UpdateVendorCategoryDto } from './dto/update-vendor-category.dto';
import { BaseCrudService } from '../../common/services/base-crud.service';

@Injectable()
export class VendorCategoryService extends BaseCrudService<VendorCategoryDocument> {
  constructor(
    @InjectModel(VendorCategory.name)
    private readonly vendorCategoryModel: Model<VendorCategoryDocument>,
  ) {
    super(vendorCategoryModel);
  }

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
    const { data, total, page: pageOut, limit: limitOut, totalPages } = await this.findAllBase({
      search,
      searchFields: ['title', 'description'],
      status,
      page,
      limit,
      sort: { order: 1, createdAt: -1 },
    });

    const totalCategories = await this.vendorCategoryModel.countDocuments();
    const activeCategories = await this.vendorCategoryModel.countDocuments({ status: 'active' });
    const inactiveCategories = await this.vendorCategoryModel.countDocuments({ status: 'inactive' });
    const maxOrderDoc = await this.vendorCategoryModel.findOne().sort({ order: -1 }).select('order').exec();
    const maxDisplayOrder = maxOrderDoc ? maxOrderDoc.order : 0;

    return {
      data,
      total,
      page: pageOut,
      limit: limitOut,
      totalPages,
      stats: { totalCategories, activeCategories, inactiveCategories, maxDisplayOrder },
    };
  }

  async findOne(id: string) {
    return this.findOneBase(id, 'Vendor category');
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
    return this.removeBase(id, 'Vendor category');
  }
}
