import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductCategory, ProductCategoryDocument } from './schemas/product-category.schema';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';

@Injectable()
export class ProductCategoryService {
  constructor(
    @InjectModel(ProductCategory.name)
    private productCategoryModel: Model<ProductCategoryDocument>,
  ) {}

  async create(createDto: CreateProductCategoryDto): Promise<ProductCategory> {
    const titleExists = await this.productCategoryModel.findOne({ title: createDto.title.trim() });
    if (titleExists) {
      throw new ConflictException(`Product category "${createDto.title}" already exists`);
    }

    const orderExists = await this.productCategoryModel.findOne({ order: createDto.order });
    if (orderExists) {
      throw new ConflictException(`Display order #${createDto.order} is already taken by "${orderExists.title}"`);
    }

    const newCategory = new this.productCategoryModel(createDto);
    return await newCategory.save();
  }

  async findAll(query: { page?: number; limit?: number; search?: string; status?: string }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 100;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.search) {
      filter.title = { $regex: query.search, $options: 'i' };
    }
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.productCategoryModel.find(filter).sort({ order: 1 }).skip(skip).limit(limit).exec(),
      this.productCategoryModel.countDocuments(filter),
    ]);

    const totalCategories = await this.productCategoryModel.countDocuments();
    const activeCategories = await this.productCategoryModel.countDocuments({ status: 'active' });
    const inactiveCategories = await this.productCategoryModel.countDocuments({ status: 'inactive' });
    const highestOrderDoc = await this.productCategoryModel.findOne().sort({ order: -1 }).exec();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      stats: {
        totalCategories,
        activeCategories,
        inactiveCategories,
        maxDisplayOrder: highestOrderDoc ? highestOrderDoc.order : 0,
      },
    };
  }

  async findOne(id: string): Promise<ProductCategoryDocument> {
    const cat = await this.productCategoryModel.findById(id).exec();
    if (!cat) {
      throw new NotFoundException(`Product category with ID ${id} not found`);
    }
    return cat;
  }

  async update(id: string, updateDto: UpdateProductCategoryDto): Promise<ProductCategory> {
    const cat = await this.findOne(id);

    if (updateDto.title && updateDto.title.trim() !== cat.title) {
      const titleExists = await this.productCategoryModel.findOne({ title: updateDto.title.trim(), _id: { $ne: id } });
      if (titleExists) {
        throw new ConflictException(`Product category "${updateDto.title}" already exists`);
      }
    }

    if (updateDto.order && updateDto.order !== cat.order) {
      const orderExists = await this.productCategoryModel.findOne({ order: updateDto.order, _id: { $ne: id } });
      if (orderExists) {
        throw new ConflictException(`Display order #${updateDto.order} is already taken by "${orderExists.title}"`);
      }
    }

    Object.assign(cat, updateDto);
    return await cat.save();
  }

  async remove(id: string): Promise<{ message: string }> {
    const cat = await this.findOne(id);
    await cat.deleteOne();
    return { message: `Product category "${cat.title}" deleted successfully` };
  }
}
