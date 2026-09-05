import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkSchedule, WorkScheduleDocument } from './schemas/work-schedule.schema';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';
import { BaseCrudService } from '../../common/services/base-crud.service';

@Injectable()
export class WorkScheduleService extends BaseCrudService<WorkScheduleDocument> {
  constructor(
    @InjectModel(WorkSchedule.name)
    private readonly workScheduleModel: Model<WorkScheduleDocument>,
  ) {
    super(workScheduleModel);
  }

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
    const { data, total, page: pageOut, limit: limitOut, totalPages } = await this.findAllBase({
      search,
      searchFields: ['scheduleName', 'shiftType'],
      status,
      page,
      limit,
      sort: { order: 1, createdAt: -1 },
    });

    const totalSchedules = await this.workScheduleModel.countDocuments();
    const activeCount = await this.workScheduleModel.countDocuments({ status: 'active' });

    return {
      data,
      total,
      page: pageOut,
      limit: limitOut,
      totalPages,
      stats: {
        totalSchedules,
        activeCount,
      },
    };
  }

  async findOne(id: string) {
    return this.findOneBase(id, 'Work schedule');
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
    return this.removeBase(id, 'Work schedule');
  }
}
