import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LatePolicy, LatePolicyDocument } from './schemas/late-policy.schema';
import { CreateLatePolicyDto } from './dto/create-late-policy.dto';
import { UpdateLatePolicyDto } from './dto/update-late-policy.dto';
import { BaseCrudService } from '../../common/services/base-crud.service';

@Injectable()
export class LatePolicyService extends BaseCrudService<LatePolicyDocument> {
  constructor(
    @InjectModel(LatePolicy.name)
    private readonly latePolicyModel: Model<LatePolicyDocument>,
  ) {
    super(latePolicyModel);
  }

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
    const { data, total, page: pageOut, limit: limitOut, totalPages } = await this.findAllBase({
      search,
      searchFields: ['policyName'],
      status,
      page,
      limit,
      sort: { createdAt: -1 },
    });

    const totalPolicies = await this.latePolicyModel.countDocuments();
    const activeCount = await this.latePolicyModel.countDocuments({ status: 'active' });

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
    return this.findOneBase(id, 'Late policy');
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
    return this.removeBase(id, 'Late policy');
  }
}
