import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OvertimePolicy, OvertimePolicyDocument } from './schemas/overtime-policy.schema';
import { OvertimeRecord, OvertimeRecordDocument } from './schemas/overtime-record.schema';
import { CreateOvertimePolicyDto } from './dto/create-overtime-policy.dto';
import { CreateOvertimeRecordDto } from './dto/create-overtime-record.dto';

@Injectable()
export class OvertimeService {
  constructor(
    @InjectModel(OvertimePolicy.name)
    private readonly overtimePolicyModel: Model<OvertimePolicyDocument>,
    @InjectModel(OvertimeRecord.name)
    private readonly overtimeRecordModel: Model<OvertimeRecordDocument>,
  ) {}

  // Policy methods
  async createPolicy(createDto: CreateOvertimePolicyDto) {
    const { policyName } = createDto;
    const existing = await this.overtimePolicyModel.findOne({
      policyName: { $regex: new RegExp(`^${policyName.trim()}$`, 'i') },
    });
    if (existing) {
      throw new BadRequestException(`Overtime policy "${policyName}" already exists.`);
    }
    const newDoc = new this.overtimePolicyModel(createDto);
    return newDoc.save();
  }

  async findAllPolicies(search?: string, status?: string) {
    const filter: any = {};
    if (search && search.trim()) {
      filter.policyName = { $regex: search.trim(), $options: 'i' };
    }
    if (status && status !== 'all') {
      filter.status = status;
    }
    const data = await this.overtimePolicyModel.find(filter).sort({ createdAt: -1 }).exec();
    const total = data.length;
    const activeCount = await this.overtimePolicyModel.countDocuments({ status: 'active' });
    return { data, total, stats: { totalPolicies: total, activeCount } };
  }

  async updatePolicy(id: string, updateDto: Partial<CreateOvertimePolicyDto>) {
    const doc = await this.overtimePolicyModel.findById(id);
    if (!doc) throw new NotFoundException('Overtime policy not found');
    if (updateDto.policyName && updateDto.policyName.trim().toLowerCase() !== doc.policyName.toLowerCase()) {
      const existing = await this.overtimePolicyModel.findOne({
        _id: { $ne: id },
        policyName: { $regex: new RegExp(`^${updateDto.policyName.trim()}$`, 'i') },
      });
      if (existing) {
        throw new BadRequestException(`Overtime policy "${updateDto.policyName}" already exists.`);
      }
    }
    return this.overtimePolicyModel.findByIdAndUpdate(id, updateDto, { new: true });
  }

  async removePolicy(id: string) {
    const deleted = await this.overtimePolicyModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Overtime policy not found');
    return { message: 'Overtime policy deleted successfully' };
  }

  // Record methods
  async createRecord(createDto: CreateOvertimeRecordDto) {
    const newDoc = new this.overtimeRecordModel(createDto);
    return newDoc.save();
  }

  async findAllRecords(search?: string, status?: string, page?: number, limit?: number) {
    const filter: any = {};
    if (search && search.trim()) {
      filter.$or = [
        { employeeName: { $regex: search.trim(), $options: 'i' } },
        { remarks: { $regex: search.trim(), $options: 'i' } },
      ];
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const total = await this.overtimeRecordModel.countDocuments(filter);
    let query = this.overtimeRecordModel.find(filter).sort({ recordDate: -1, createdAt: -1 });

    if (page && limit) {
      query = query.skip((page - 1) * limit).limit(limit);
    }

    const data = await query.exec();
    const totalPages = limit ? Math.ceil(total / limit) || 1 : 1;

    const totalRecords = await this.overtimeRecordModel.countDocuments();
    const approvedCount = await this.overtimeRecordModel.countDocuments({ status: 'approved' });

    return {
      data,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages,
      stats: {
        totalRecords,
        approvedCount,
      },
    };
  }

  async updateRecord(id: string, updateDto: Partial<CreateOvertimeRecordDto>) {
    const doc = await this.overtimeRecordModel.findById(id);
    if (!doc) throw new NotFoundException('Overtime record not found');
    return this.overtimeRecordModel.findByIdAndUpdate(id, updateDto, { new: true });
  }

  async removeRecord(id: string) {
    const deleted = await this.overtimeRecordModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Overtime record not found');
    return { message: 'Overtime record deleted successfully' };
  }
}
