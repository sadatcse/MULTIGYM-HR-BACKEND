import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LeaveType, LeaveTypeDocument } from './schemas/leave-type.schema';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';

@Injectable()
export class LeaveTypeService {
  constructor(
    @InjectModel(LeaveType.name)
    private readonly leaveTypeModel: Model<LeaveTypeDocument>,
  ) {}

  async create(createDto: CreateLeaveTypeDto) {
    const { name, order } = createDto;

    const existingName = await this.leaveTypeModel.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (existingName) {
      throw new BadRequestException(`Leave type "${name}" already exists.`);
    }

    if (!order) {
      const maxDoc = await this.leaveTypeModel.findOne().sort({ order: -1 }).exec();
      createDto.order = maxDoc ? maxDoc.order + 1 : 1;
    }

    const newDoc = new this.leaveTypeModel(createDto);
    return newDoc.save();
  }

  async findAll(search?: string, status?: string, page?: number, limit?: number) {
    const filter: any = {};
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const total = await this.leaveTypeModel.countDocuments(filter);
    let query = this.leaveTypeModel.find(filter).sort({ order: 1, createdAt: -1 });

    if (page && limit) {
      query = query.skip((page - 1) * limit).limit(limit);
    }

    const data = await query.exec();
    const totalPages = limit ? Math.ceil(total / limit) || 1 : 1;

    const totalLeaveTypes = await this.leaveTypeModel.countDocuments();
    const activeCount = await this.leaveTypeModel.countDocuments({ status: 'active' });
    const paidCount = await this.leaveTypeModel.countDocuments({ isPaid: 'yes' });

    return {
      data,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages,
      stats: {
        totalLeaveTypes,
        activeCount,
        paidCount,
      },
    };
  }

  async findOne(id: string) {
    const doc = await this.leaveTypeModel.findById(id);
    if (!doc) throw new NotFoundException(`Leave type not found`);
    return doc;
  }

  async update(id: string, updateDto: UpdateLeaveTypeDto) {
    const doc = await this.leaveTypeModel.findById(id);
    if (!doc) throw new NotFoundException(`Leave type not found`);

    if (updateDto.name && updateDto.name.trim().toLowerCase() !== doc.name.toLowerCase()) {
      const existing = await this.leaveTypeModel.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${updateDto.name.trim()}$`, 'i') },
      });
      if (existing) {
        throw new BadRequestException(`Leave type "${updateDto.name}" already exists.`);
      }
    }

    return this.leaveTypeModel.findByIdAndUpdate(id, updateDto, { new: true });
  }

  async remove(id: string) {
    const deleted = await this.leaveTypeModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException(`Leave type not found`);
    return { message: 'Leave type deleted successfully' };
  }
}
