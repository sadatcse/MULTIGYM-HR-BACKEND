import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdvancePolicy, AdvancePolicyDocument } from './schemas/advance-policy.schema';
import { CreateAdvancePolicyDto } from './dto/create-advance-policy.dto';
import { UpdateAdvancePolicyDto } from './dto/update-advance-policy.dto';
import { BaseCrudService } from '../../common/services/base-crud.service';

@Injectable()
export class AdvancePolicyService extends BaseCrudService<AdvancePolicyDocument> {
  constructor(
    @InjectModel(AdvancePolicy.name)
    private readonly advancePolicyModel: Model<AdvancePolicyDocument>,
  ) {
    super(advancePolicyModel);
  }

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
    const { data, total, page: pageOut, limit: limitOut, totalPages } = await this.findAllBase({
      search,
      searchFields: ['policyName'],
      status,
      page,
      limit,
      sort: { createdAt: -1 },
    });

    const totalPolicies = await this.advancePolicyModel.countDocuments();
    const activeCount = await this.advancePolicyModel.countDocuments({ status: 'active' });

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
    return this.findOneBase(id, 'Advance policy');
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
    return this.removeBase(id, 'Advance policy');
  }
}
