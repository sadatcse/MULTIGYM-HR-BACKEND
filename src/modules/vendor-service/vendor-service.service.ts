import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorServiceRecord, VendorServiceRecordDocument } from './schemas/vendor-service-record.schema';
import { Vendor, VendorDocument } from '../vendor/schemas/vendor.schema';
import { CreateVendorServiceRecordDto } from './dto/create-vendor-service-record.dto';
import { UpdateVendorServiceRecordDto } from './dto/update-vendor-service-record.dto';

import { AddPaymentDto } from '../vendor-purchase/dto/add-payment.dto';

function computePaymentStatus(totalAmount: number, amountPaid: number, dueDate?: Date | string | null) {
  const amountDue = Math.max(totalAmount - amountPaid, 0);
  if (amountDue <= 0 && totalAmount > 0) return 'paid';
  if (dueDate && new Date(dueDate) < new Date() && amountDue > 0) return 'overdue';
  if (amountPaid > 0) return 'partial';
  return 'pending';
}

@Injectable()
export class VendorServiceRecordService {
  constructor(
    @InjectModel(VendorServiceRecord.name) private readonly serviceModel: Model<VendorServiceRecordDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
  ) {}

  async create(dto: CreateVendorServiceRecordDto) {
    const vendorExists = await this.vendorModel.exists({ _id: dto.vendor });
    if (!vendorExists) {
      throw new BadRequestException('Vendor not found');
    }

    const cost = dto.serviceCost || 0;
    const initialPayments: any[] = [];
    let amountPaid = 0;
    if (dto.initialPaymentAmount && dto.initialPaymentAmount > 0) {
      amountPaid = Math.min(dto.initialPaymentAmount, cost);
      initialPayments.push({
        amount: amountPaid,
        paymentDate: dto.serviceDate ? new Date(dto.serviceDate) : new Date(),
        method: dto.initialPaymentMethod || 'cash',
        reference: dto.initialPaymentReference || undefined,
        note: dto.initialPaymentNote || 'Initial service payment recorded',
      });
    }

    const created = await this.serviceModel.create({
      ...dto,
      payments: initialPayments,
      amountPaid,
      amountDue: Math.max(cost - amountPaid, 0),
      paymentStatus: computePaymentStatus(cost, amountPaid, dto.dueDate),
    });
    return created;
  }

  async findAll(query: Record<string, any>) {
    const { vendor, search, completionStatus, paymentStatus } = query;
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (vendor) filter.vendor = vendor;
    if (completionStatus && completionStatus !== 'all') filter.completionStatus = completionStatus;
    if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;
    if (search) {
      filter.$or = [
        { serviceType: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { assignedTechnician: { $regex: search, $options: 'i' } },
        { serviceRequestRef: { $regex: search, $options: 'i' } },
      ];
    }

    const [totalItems, data] = await Promise.all([
      this.serviceModel.countDocuments(filter),
      this.serviceModel.find(filter).sort({ serviceDate: -1 }).skip(skip).limit(limit),
    ]);

    return {
      data,
      total: totalItems,
      totalPages: Math.ceil(totalItems / limit) || 1,
      currentPage: page,
      pageSize: limit,
    };
  }

  async findById(id: string) {
    const result = await this.serviceModel.findById(id);
    if (!result) {
      throw new NotFoundException('Service record not found');
    }
    return result;
  }

  private async findRaw(id: string) {
    const result = await this.serviceModel.findById(id);
    if (!result) {
      throw new NotFoundException('Service record not found');
    }
    return result;
  }

  async update(id: string, dto: UpdateVendorServiceRecordDto) {
    const existing = await this.findRaw(id);
    const cost = dto.serviceCost !== undefined ? dto.serviceCost : existing.serviceCost || 0;
    const dueDate = dto.dueDate !== undefined ? dto.dueDate : existing.dueDate;

    const result = await this.serviceModel.findByIdAndUpdate(
      id,
      {
        ...dto,
        amountDue: Math.max(cost - existing.amountPaid, 0),
        paymentStatus: computePaymentStatus(cost, existing.amountPaid, dueDate),
      },
      { new: true, runValidators: true },
    );
    if (!result) {
      throw new NotFoundException('Service record not found');
    }
    return result;
  }

  async remove(id: string) {
    const result = await this.serviceModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Service record not found');
    }
    return { message: 'Service record deleted successfully' };
  }

  async addPayment(id: string, dto: AddPaymentDto) {
    const existing = await this.findRaw(id);
    const cost = existing.serviceCost || 0;

    if (dto.amount > existing.amountDue) {
      throw new BadRequestException(
        `Payment amount cannot exceed the remaining due amount (${existing.amountDue}).`,
      );
    }

    existing.payments.push(dto as any);
    const amountPaid = existing.amountPaid + dto.amount;
    existing.amountPaid = amountPaid;
    existing.amountDue = Math.max(cost - amountPaid, 0);
    existing.paymentStatus = computePaymentStatus(cost, amountPaid, existing.dueDate);

    await existing.save();
    return existing;
  }

  async removePayment(id: string, paymentId: string) {
    const existing = await this.findRaw(id);
    const cost = existing.serviceCost || 0;

    const payment = (existing.payments as any).id(paymentId);
    if (!payment) {
      throw new NotFoundException('Payment entry not found');
    }
    const removedAmount = payment.amount;
    (existing.payments as any).pull(paymentId);

    const amountPaid = Math.max(existing.amountPaid - removedAmount, 0);
    existing.amountPaid = amountPaid;
    existing.amountDue = Math.max(cost - amountPaid, 0);
    existing.paymentStatus = computePaymentStatus(cost, amountPaid, existing.dueDate);

    await existing.save();
    return existing;
  }

  // Upcoming services within the next N days
  async findUpcoming(days = 30, vendorId?: string) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const filter: Record<string, any> = { nextServiceDate: { $gte: now, $lte: cutoff } };
    if (vendorId) filter.vendor = vendorId;

    return this.serviceModel.find(filter).populate('vendor', 'name category').sort({ nextServiceDate: 1 });
  }
}
