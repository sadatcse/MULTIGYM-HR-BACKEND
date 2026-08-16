import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkSchedule, WorkScheduleDocument } from './schemas/work-schedule.schema';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';

@Injectable()
export class WorkScheduleService {
  constructor(
    @InjectModel(WorkSchedule.name)
    private readonly workScheduleModel: Model<WorkScheduleDocument>,
  ) {}

  async create(createDto: CreateWorkScheduleDto) {
    const { scheduleName, order } = createDto;

    const existingName = await this.workScheduleModel.findOne({
      scheduleName: { $regex: new RegExp(`^${scheduleName.trim()}$`, 'i') },
    });
    if (existingName) {
      throw new BadRequestException(`Schedule name "${scheduleName}" already exists.`);
    }

    if (!order) {
      const maxDoc = await this.workScheduleModel.findOne().sort({ order: -1 }).exec();
      createDto.order = maxDoc ? maxDoc.order + 1 : 1;
    }

    const newDoc = new this.workScheduleModel(createDto);
    return newDoc.save();
  }

  async findAll(search?: string, status?: string, page?: number, limit?: number) {
    const filter: any = {};
    if (search && search.trim()) {
      filter.$or = [
        { scheduleName: { $regex: search.trim(), $options: 'i' } },
        { shiftType: { $regex: search.trim(), $options: 'i' } },
      ];
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const total = await this.workScheduleModel.countDocuments(filter);
    let query = this.workScheduleModel.find(filter).sort({ order: 1, createdAt: -1 });

    if (page && limit) {
      query = query.skip((page - 1) * limit).limit(limit);
    }

    const data = await query.exec();
    const totalPages = limit ? Math.ceil(total / limit) || 1 : 1;

    const totalSchedules = await this.workScheduleModel.countDocuments();
    const activeCount = await this.workScheduleModel.countDocuments({ status: 'active' });

    return {
      data,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages,
      stats: {
        totalSchedules,
        activeCount,
      },
    };
  }

  async findOne(id: string) {
    const doc = await this.workScheduleModel.findById(id);
    if (!doc) throw new NotFoundException(`Work schedule not found`);
    return doc;
  }

  async update(id: string, updateDto: UpdateWorkScheduleDto) {
    const doc = await this.workScheduleModel.findById(id);
    if (!doc) throw new NotFoundException(`Work schedule not found`);

    if (updateDto.scheduleName && updateDto.scheduleName.trim().toLowerCase() !== doc.scheduleName.toLowerCase()) {
      const existing = await this.workScheduleModel.findOne({
        _id: { $ne: id },
        scheduleName: { $regex: new RegExp(`^${updateDto.scheduleName.trim()}$`, 'i') },
      });
      if (existing) {
        throw new BadRequestException(`Schedule name "${updateDto.scheduleName}" already exists.`);
      }
    }

    return this.workScheduleModel.findByIdAndUpdate(id, updateDto, { new: true });
  }

  async remove(id: string) {
    const deleted = await this.workScheduleModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException(`Work schedule not found`);
    return { message: 'Work schedule deleted successfully' };
  }
}
