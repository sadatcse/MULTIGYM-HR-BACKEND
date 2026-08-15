import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Branch, BranchDocument } from './schemas/branch.schema';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchService {
  constructor(
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  async create(createDto: CreateBranchDto) {
    const { name, order } = createDto;

    // Check duplicate name
    const existingName = await this.branchModel.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (existingName) {
      throw new BadRequestException(`Branch "${name}" already exists.`);
    }

    // Check duplicate order
    const existingOrder = await this.branchModel.findOne({ order });
    if (existingOrder) {
      throw new BadRequestException(`Order number ${order} is already assigned to "${existingOrder.name}".`);
    }

    const newBranch = new this.branchModel(createDto);
    return newBranch.save();
  }

  async findAll(search?: string, status?: string, page?: number, limit?: number) {
    const filter: any = {};
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { address: { $regex: search.trim(), $options: 'i' } },
        { phone: { $regex: search.trim(), $options: 'i' } },
      ];
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const total = await this.branchModel.countDocuments(filter);

    let query = this.branchModel.find(filter).sort({ order: 1, createdAt: -1 });

    if (page && limit) {
      const skip = (page - 1) * limit;
      query = query.skip(skip).limit(limit);
    }

    const data = await query.exec();
    const totalPages = limit ? Math.ceil(total / limit) || 1 : 1;

    // Aggregate system-wide KPI statistics for Branches
    const totalBranches = await this.branchModel.countDocuments();
    const activeBranches = await this.branchModel.countDocuments({ status: 'active' });
    const inactiveBranches = await this.branchModel.countDocuments({ status: 'inactive' });
    const maxOrderDoc = await this.branchModel.findOne().sort({ order: -1 }).select('order').exec();
    const maxDisplayOrder = maxOrderDoc ? maxOrderDoc.order : 0;

    return {
      data,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages,
      stats: {
        totalBranches,
        activeBranches,
        inactiveBranches,
        maxDisplayOrder,
      },
    };
  }

  async findOne(id: string) {
    const branch = await this.branchModel.findById(id);
    if (!branch) {
      throw new NotFoundException(`Branch not found`);
    }
    return branch;
  }

  async update(id: string, updateDto: UpdateBranchDto) {
    const branch = await this.branchModel.findById(id);
    if (!branch) {
      throw new NotFoundException(`Branch not found`);
    }

    if (updateDto.name && updateDto.name.trim().toLowerCase() !== branch.name.toLowerCase()) {
      const existingName = await this.branchModel.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${updateDto.name.trim()}$`, 'i') },
      });
      if (existingName) {
        throw new BadRequestException(`Branch "${updateDto.name}" already exists.`);
      }
    }

    if (updateDto.order && updateDto.order !== branch.order) {
      const existingOrder = await this.branchModel.findOne({
        _id: { $ne: id },
        order: updateDto.order,
      });
      if (existingOrder) {
        throw new BadRequestException(`Order number ${updateDto.order} is already assigned to "${existingOrder.name}".`);
      }
    }

    return this.branchModel.findByIdAndUpdate(id, updateDto, { new: true, runValidators: true });
  }

  async remove(id: string) {
    const result = await this.branchModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`Branch not found`);
    }
    return { message: 'Branch deleted successfully' };
  }
}
