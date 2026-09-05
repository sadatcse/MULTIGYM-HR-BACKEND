import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Shift, ShiftDocument } from './schemas/shift.schema';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { BaseCrudService } from '../../common/services/base-crud.service';

@Injectable()
export class ShiftService extends BaseCrudService<ShiftDocument> {
  constructor(
    @InjectModel(Shift.name)
    private readonly shiftModel: Model<ShiftDocument>,
  ) {
    super(shiftModel);
  }

  async create(createDto: CreateShiftDto) {
    const { name, order } = createDto;

    // Check duplicate shift name
    const existingName = await this.shiftModel.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (existingName) {
      throw new BadRequestException(`Shift name "${name}" already exists.`);
    }

    // Check duplicate order
    const existingOrder = await this.shiftModel.findOne({ order });
    if (existingOrder) {
      throw new BadRequestException(`Order number ${order} is already assigned to "${existingOrder.name}".`);
    }

    const newShift = new this.shiftModel(createDto);
    return newShift.save();
  }

  async findAll(search?: string, status?: string, page?: number, limit?: number) {
    const { data, total, page: pageOut, limit: limitOut, totalPages } = await this.findAllBase({
      search,
      searchFields: ['name', 'description'],
      status,
      page,
      limit,
      sort: { order: 1, createdAt: -1 },
    });

    // Aggregate KPI Statistics
    const totalShifts = await this.shiftModel.countDocuments();
    const activeShifts = await this.shiftModel.countDocuments({ status: 'active' });
    const inactiveShifts = await this.shiftModel.countDocuments({ status: 'inactive' });
    const maxOrderDoc = await this.shiftModel.findOne().sort({ order: -1 }).select('order').exec();
    const maxDisplayOrder = maxOrderDoc ? maxOrderDoc.order : 0;

    return {
      data,
      total,
      page: pageOut,
      limit: limitOut,
      totalPages,
      stats: {
        totalShifts,
        activeShifts,
        inactiveShifts,
        maxDisplayOrder,
      },
    };
  }

  async findOne(id: string) {
    return this.findOneBase(id, 'Shift');
  }

  async update(id: string, updateDto: UpdateShiftDto) {
    const shift = await this.shiftModel.findById(id);
    if (!shift) {
      throw new NotFoundException(`Shift not found`);
    }

    if (updateDto.name && updateDto.name.trim().toLowerCase() !== shift.name.toLowerCase()) {
      const existingName = await this.shiftModel.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${updateDto.name.trim()}$`, 'i') },
      });
      if (existingName) {
        throw new BadRequestException(`Shift name "${updateDto.name}" already exists.`);
      }
    }

    if (updateDto.order && updateDto.order !== shift.order) {
      const existingOrder = await this.shiftModel.findOne({
        _id: { $ne: id },
        order: updateDto.order,
      });
      if (existingOrder) {
        throw new BadRequestException(`Order number ${updateDto.order} is already assigned to "${existingOrder.name}".`);
      }
    }

    return this.shiftModel.findByIdAndUpdate(id, updateDto, { new: true, runValidators: true });
  }

  async remove(id: string) {
    return this.removeBase(id, 'Shift');
  }
}
