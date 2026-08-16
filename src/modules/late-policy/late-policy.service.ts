import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LatePolicy, LatePolicyDocument } from './schemas/late-policy.schema';
import { CreateLatePolicyDto } from './dto/create-late-policy.dto';
import { UpdateLatePolicyDto } from './dto/update-late-policy.dto';

@Injectable()
export class LatePolicyService {
  constructor(
    @InjectModel(LatePolicy.name)
    private readonly latePolicyModel: Model<LatePolicyDocument>,
  ) {}

  async create(createDto: CreateLatePolicyDto) {
    const { policyName } = createDto;

    const existingName = await this.latePolicyModel.findOne({
      policyName: { $regex: new RegExp(`^${policyName.trim()}$`, 'i') },
    });
    if (existingName) {
      throw new BadRequestException(`Late policy "${policyName}" already exists.`);
    }

    const newDoc = new this.latePolicyModel(createDto);
    return newDoc.save();
  }

  async findAll(search?: string, status?: string, page?: number, limit?: number) {
    const filter: any = {};
    if (search && search.trim()) {
      filter.policyName = { $regex: search.trim(), $options: 'i' };
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const total = await this.latePolicyModel.countDocuments(filter);
    let query = this.latePolicyModel.find(filter).sort({ createdAt: -1 });

    if (page && limit) {
      query = query.skip((page - 1) * limit).limit(limit);
    }

    const data = await query.exec();
    const totalPages = limit ? Math.ceil(total / limit) || 1 : 1;

    const totalPolicies = await this.latePolicyModel.countDocuments();
    const activeCount = await this.latePolicyModel.countDocuments({ status: 'active' });

    return {
      data,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages,
      stats: {
        totalPolicies,
        activeCount,
      },
    };
  }

  async findOne(id: string) {
    const doc = await this.latePolicyModel.findById(id);
    if (!doc) throw new NotFoundException(`Late policy not found`);
    return doc;
  }

  async update(id: string, updateDto: UpdateLatePolicyDto) {
    const doc = await this.latePolicyModel.findById(id);
    if (!doc) throw new NotFoundException(`Late policy not found`);

    if (updateDto.policyName && updateDto.policyName.trim().toLowerCase() !== doc.policyName.toLowerCase()) {
      const existing = await this.latePolicyModel.findOne({
        _id: { $ne: id },
        policyName: { $regex: new RegExp(`^${updateDto.policyName.trim()}$`, 'i') },
      });
      if (existing) {
        throw new BadRequestException(`Late policy "${updateDto.policyName}" already exists.`);
      }
    }

    return this.latePolicyModel.findByIdAndUpdate(id, updateDto, { new: true });
  }

  async remove(id: string) {
    const deleted = await this.latePolicyModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException(`Late policy not found`);
    return { message: 'Late policy deleted successfully' };
  }
}
