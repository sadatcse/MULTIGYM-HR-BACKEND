import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JobPosition, JobPositionDocument } from './schemas/job-position.schema';
import { CreateJobPositionDto } from './dto/create-job-position.dto';
import { UpdateJobPositionDto } from './dto/update-job-position.dto';
import { BaseCrudService } from '../../common/services/base-crud.service';

@Injectable()
export class JobPositionService extends BaseCrudService<JobPositionDocument> {
  constructor(
    @InjectModel(JobPosition.name)
    private readonly jobPositionModel: Model<JobPositionDocument>,
  ) {
    super(jobPositionModel);
  }

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
    const { data, total, page: pageOut, limit: limitOut, totalPages } = await this.findAllBase({
      search,
      searchFields: ['title', 'department', 'description'],
      status,
      page,
      limit,
      sort: { order: 1, createdAt: -1 },
    });

    // Aggregate system-wide KPI statistics for Job Positions
    const totalJobPositions = await this.jobPositionModel.countDocuments();
    const activeJobPositions = await this.jobPositionModel.countDocuments({ status: 'active' });
    const inactiveJobPositions = await this.jobPositionModel.countDocuments({ status: 'inactive' });
    const maxOrderDoc = await this.jobPositionModel.findOne().sort({ order: -1 }).select('order').exec();
    const maxDisplayOrder = maxOrderDoc ? maxOrderDoc.order : 0;

    return {
      data,
      total,
      page: pageOut,
      limit: limitOut,
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
    return this.findOneBase(id, 'Job position');
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
    return this.removeBase(id, 'Job position');
  }
}
