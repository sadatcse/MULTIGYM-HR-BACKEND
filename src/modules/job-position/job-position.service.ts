import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JobPosition, JobPositionDocument } from './schemas/job-position.schema';
import { CreateJobPositionDto } from './dto/create-job-position.dto';
import { UpdateJobPositionDto } from './dto/update-job-position.dto';

@Injectable()
export class JobPositionService {
  constructor(
    @InjectModel(JobPosition.name)
    private readonly jobPositionModel: Model<JobPositionDocument>,
  ) {}

  async create(createDto: CreateJobPositionDto) {
    const { title, order } = createDto;

    // Check duplicate title
    const existingTitle = await this.jobPositionModel.findOne({
      title: { $regex: new RegExp(`^${title.trim()}$`, 'i') },
    });
    if (existingTitle) {
      throw new BadRequestException(`Job position "${title}" already exists.`);
    }

    // Check duplicate order
    const existingOrder = await this.jobPositionModel.findOne({ order });
    if (existingOrder) {
      throw new BadRequestException(`Order number ${order} is already assigned to "${existingOrder.title}".`);
    }

    const newPosition = new this.jobPositionModel(createDto);
    return newPosition.save();
  }

  async findAll(search?: string, status?: string, page?: number, limit?: number) {
    const filter: any = {};
    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { department: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const total = await this.jobPositionModel.countDocuments(filter);

    let query = this.jobPositionModel.find(filter).sort({ order: 1, createdAt: -1 });

    if (page && limit) {
      const skip = (page - 1) * limit;
      query = query.skip(skip).limit(limit);
    }

    const data = await query.exec();
    const totalPages = limit ? Math.ceil(total / limit) || 1 : 1;

    // Aggregate system-wide KPI statistics for Job Positions
    const totalJobPositions = await this.jobPositionModel.countDocuments();
    const activeJobPositions = await this.jobPositionModel.countDocuments({ status: 'active' });
    const inactiveJobPositions = await this.jobPositionModel.countDocuments({ status: 'inactive' });
    const maxOrderDoc = await this.jobPositionModel.findOne().sort({ order: -1 }).select('order').exec();
    const maxDisplayOrder = maxOrderDoc ? maxOrderDoc.order : 0;

    return {
      data,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages,
      stats: {
        totalJobPositions,
        activeJobPositions,
        inactiveJobPositions,
        maxDisplayOrder,
      },
    };
  }

  async findOne(id: string) {
    const position = await this.jobPositionModel.findById(id);
    if (!position) {
      throw new NotFoundException(`Job position not found`);
    }
    return position;
  }

  async update(id: string, updateDto: UpdateJobPositionDto) {
    const position = await this.jobPositionModel.findById(id);
    if (!position) {
      throw new NotFoundException(`Job position not found`);
    }

    if (updateDto.title && updateDto.title.trim().toLowerCase() !== position.title.toLowerCase()) {
      const existingTitle = await this.jobPositionModel.findOne({
        _id: { $ne: id },
        title: { $regex: new RegExp(`^${updateDto.title.trim()}$`, 'i') },
      });
      if (existingTitle) {
        throw new BadRequestException(`Job position "${updateDto.title}" already exists.`);
      }
    }

    if (updateDto.order && updateDto.order !== position.order) {
      const existingOrder = await this.jobPositionModel.findOne({
        _id: { $ne: id },
        order: updateDto.order,
      });
      if (existingOrder) {
        throw new BadRequestException(`Order number ${updateDto.order} is already assigned to "${existingOrder.title}".`);
      }
    }

    return this.jobPositionModel.findByIdAndUpdate(id, updateDto, { new: true, runValidators: true });
  }

  async remove(id: string) {
    const result = await this.jobPositionModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`Job position not found`);
    }
    return { message: 'Job position deleted successfully' };
  }
}
