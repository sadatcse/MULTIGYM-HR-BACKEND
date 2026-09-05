import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BonusPolicy, BonusPolicyDocument } from './schemas/bonus-policy.schema';
import { CreateBonusPolicyDto } from './dto/create-bonus-policy.dto';
import { UpdateBonusPolicyDto } from './dto/update-bonus-policy.dto';
import { BaseCrudService } from '../../common/services/base-crud.service';

@Injectable()
export class BonusPolicyService extends BaseCrudService<BonusPolicyDocument> {
  constructor(
    @InjectModel(BonusPolicy.name)
    private readonly bonusPolicyModel: Model<BonusPolicyDocument>,
  ) {
    super(bonusPolicyModel);
  }

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
    const { data, total, page: pageOut, limit: limitOut, totalPages } = await this.findAllBase({
      search,
      searchFields: ['policyName'],
      status,
      page,
      limit,
      sort: { createdAt: -1 },
    });

    const totalPolicies = await this.bonusPolicyModel.countDocuments();
    const activeCount = await this.bonusPolicyModel.countDocuments({ status: 'active' });

    return {
      data,
      total,
      page: pageOut,
      limit: limitOut,
      totalPages,
      stats: {
        totalPolicies,
        activeCount,
      },
    };
  }

  async findOne(id: string) {
    return this.findOneBase(id, 'Bonus policy');
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
    return this.removeBase(id, 'Bonus policy');
  }
}
