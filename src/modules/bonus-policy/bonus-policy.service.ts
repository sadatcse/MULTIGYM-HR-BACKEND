import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BonusPolicy, BonusPolicyDocument } from './schemas/bonus-policy.schema';
import { CreateBonusPolicyDto } from './dto/create-bonus-policy.dto';
import { UpdateBonusPolicyDto } from './dto/update-bonus-policy.dto';

@Injectable()
export class BonusPolicyService {
  constructor(
    @InjectModel(BonusPolicy.name)
    private readonly bonusPolicyModel: Model<BonusPolicyDocument>,
  ) {}

  async create(createDto: CreateBonusPolicyDto) {
    const { policyName } = createDto;

    const existingName = await this.bonusPolicyModel.findOne({
      policyName: { $regex: new RegExp(`^${policyName.trim()}$`, 'i') },
    });
    if (existingName) {
      throw new BadRequestException(`Bonus policy "${policyName}" already exists.`);
    }

    const newDoc = new this.bonusPolicyModel(createDto);
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

    const total = await this.bonusPolicyModel.countDocuments(filter);
    let query = this.bonusPolicyModel.find(filter).sort({ createdAt: -1 });

    if (page && limit) {
      query = query.skip((page - 1) * limit).limit(limit);
    }

    const data = await query.exec();
    const totalPages = limit ? Math.ceil(total / limit) || 1 : 1;

    const totalPolicies = await this.bonusPolicyModel.countDocuments();
    const activeCount = await this.bonusPolicyModel.countDocuments({ status: 'active' });

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
    const doc = await this.bonusPolicyModel.findById(id);
    if (!doc) throw new NotFoundException(`Bonus policy not found`);
    return doc;
  }

  async update(id: string, updateDto: UpdateBonusPolicyDto) {
    const doc = await this.bonusPolicyModel.findById(id);
    if (!doc) throw new NotFoundException(`Bonus policy not found`);

    if (updateDto.policyName && updateDto.policyName.trim().toLowerCase() !== doc.policyName.toLowerCase()) {
      const existing = await this.bonusPolicyModel.findOne({
        _id: { $ne: id },
        policyName: { $regex: new RegExp(`^${updateDto.policyName.trim()}$`, 'i') },
      });
      if (existing) {
        throw new BadRequestException(`Bonus policy "${updateDto.policyName}" already exists.`);
      }
    }

    return this.bonusPolicyModel.findByIdAndUpdate(id, updateDto, { new: true });
  }

  async remove(id: string) {
    const deleted = await this.bonusPolicyModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException(`Bonus policy not found`);
    return { message: 'Bonus policy deleted successfully' };
  }
}
