import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdvancePolicy, AdvancePolicyDocument } from './schemas/advance-policy.schema';
import { CreateAdvancePolicyDto } from './dto/create-advance-policy.dto';
import { UpdateAdvancePolicyDto } from './dto/update-advance-policy.dto';

@Injectable()
export class AdvancePolicyService {
  constructor(
    @InjectModel(AdvancePolicy.name)
    private readonly advancePolicyModel: Model<AdvancePolicyDocument>,
  ) {}

  async create(createDto: CreateAdvancePolicyDto) {
    const { policyName } = createDto;

    const existingName = await this.advancePolicyModel.findOne({
      policyName: { $regex: new RegExp(`^${policyName.trim()}$`, 'i') },
    });
    if (existingName) {
      throw new BadRequestException(`Advance policy "${policyName}" already exists.`);
    }

    const newDoc = new this.advancePolicyModel(createDto);
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

    const total = await this.advancePolicyModel.countDocuments(filter);
    let query = this.advancePolicyModel.find(filter).sort({ createdAt: -1 });

    if (page && limit) {
      query = query.skip((page - 1) * limit).limit(limit);
    }

    const data = await query.exec();
    const totalPages = limit ? Math.ceil(total / limit) || 1 : 1;

    const totalPolicies = await this.advancePolicyModel.countDocuments();
    const activeCount = await this.advancePolicyModel.countDocuments({ status: 'active' });

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
    const doc = await this.advancePolicyModel.findById(id);
    if (!doc) throw new NotFoundException(`Advance policy not found`);
    return doc;
  }

  async update(id: string, updateDto: UpdateAdvancePolicyDto) {
    const doc = await this.advancePolicyModel.findById(id);
    if (!doc) throw new NotFoundException(`Advance policy not found`);

    if (updateDto.policyName && updateDto.policyName.trim().toLowerCase() !== doc.policyName.toLowerCase()) {
      const existing = await this.advancePolicyModel.findOne({
        _id: { $ne: id },
        policyName: { $regex: new RegExp(`^${updateDto.policyName.trim()}$`, 'i') },
      });
      if (existing) {
        throw new BadRequestException(`Advance policy "${updateDto.policyName}" already exists.`);
      }
    }

    return this.advancePolicyModel.findByIdAndUpdate(id, updateDto, { new: true });
  }

  async remove(id: string) {
    const deleted = await this.advancePolicyModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException(`Advance policy not found`);
    return { message: 'Advance policy deleted successfully' };
  }
}
