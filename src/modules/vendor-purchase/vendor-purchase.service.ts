import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorPurchase, VendorPurchaseDocument } from './schemas/vendor-purchase.schema';
import { Vendor, VendorDocument } from '../vendor/schemas/vendor.schema';
import { CreateVendorPurchaseDto, PurchaseItemInputDto } from './dto/create-vendor-purchase.dto';
import { UpdateVendorPurchaseDto } from './dto/update-vendor-purchase.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { computeExpiryStatus } from '../../common/helpers/expiry-status.helper';

function withComputedItems(purchase: any) {
  const obj = purchase.toObject ? purchase.toObject() : purchase;
  return {
    ...obj,
    items: (obj.items || []).map((item: any) => ({
      ...item,
      warrantyStatus: computeExpiryStatus(item.warranty?.endDate, !!item.warranty?.available),
    })),
  };
}

function buildItemsWithTotals(items: PurchaseItemInputDto[]) {
  return items.map((item) => {
    const quantity = item.quantity ?? 1;
    return {
      ...item,
      quantity,
      totalPrice: quantity * item.unitPrice,
      warranty: item.warranty?.available ? item.warranty : { available: false },
    };
  });
}

function computeTotalAmount(items: any[]) {
  return items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

function computePaymentStatus(totalAmount: number, amountPaid: number, dueDate?: Date | string | null) {
  const amountDue = Math.max(totalAmount - amountPaid, 0);
  if (amountDue <= 0 && totalAmount > 0) return 'paid';
  if (dueDate && new Date(dueDate) < new Date() && amountDue > 0) return 'overdue';
  if (amountPaid > 0) return 'partial';
  return 'pending';
}

@Injectable()
export class VendorPurchaseService {
  constructor(
    @InjectModel(VendorPurchase.name) private readonly purchaseModel: Model<VendorPurchaseDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
  ) {}

  async create(dto: CreateVendorPurchaseDto) {
    const vendorExists = await this.vendorModel.exists({ _id: dto.vendor });
    if (!vendorExists) {
      throw new BadRequestException('Vendor not found');
    }

    const items = buildItemsWithTotals(dto.items);
    const totalAmount = computeTotalAmount(items);

    const initialPayments: any[] = [];
    let amountPaid = 0;
    if (dto.initialPaymentAmount && dto.initialPaymentAmount > 0) {
      amountPaid = Math.min(dto.initialPaymentAmount, totalAmount);
      initialPayments.push({
        amount: amountPaid,
        paymentDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
        method: dto.initialPaymentMethod || 'cash',
        reference: dto.initialPaymentReference || undefined,
        note: dto.initialPaymentNote || 'Initial payment recorded on order creation',
      });
    }

    const created = await this.purchaseModel.create({
      ...dto,
      items,
      payments: initialPayments,
      totalAmount,
      amountPaid,
      amountDue: Math.max(totalAmount - amountPaid, 0),
      paymentStatus: computePaymentStatus(totalAmount, amountPaid, dto.dueDate),
    });
    return withComputedItems(created);
  }

  async findAll(query: Record<string, any>) {
    const { vendor, search, paymentStatus, warrantyStatus } = query;
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (vendor) filter.vendor = vendor;
    if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;
    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { purchaseOrderNumber: { $regex: search, $options: 'i' } },
        { 'items.productName': { $regex: search, $options: 'i' } },
        { 'items.productCategory': { $regex: search, $options: 'i' } },
        { 'items.warranty.serialNumber': { $regex: search, $options: 'i' } },
        { 'items.warranty.assetId': { $regex: search, $options: 'i' } },
      ];
    }

    const [totalItems, data] = await Promise.all([
      this.purchaseModel.countDocuments(filter),
      this.purchaseModel.find(filter).sort({ purchaseDate: -1 }).skip(skip).limit(limit),
    ]);

    let items = data.map(withComputedItems);
    if (warrantyStatus && warrantyStatus !== 'all') {
      items = items.filter((p) => p.items.some((i: any) => i.warrantyStatus === warrantyStatus));
    }

    return {
      data: items,
      total: totalItems,
      totalPages: Math.ceil(totalItems / limit) || 1,
      currentPage: page,
      pageSize: limit,
    };
  }

  async findById(id: string) {
    const result = await this.purchaseModel.findById(id);
    if (!result) {
      throw new NotFoundException('Purchase record not found');
    }
    return withComputedItems(result);
  }

  private async findRaw(id: string) {
    const result = await this.purchaseModel.findById(id);
    if (!result) {
      throw new NotFoundException('Purchase record not found');
    }
    return result;
  }

  async update(id: string, dto: UpdateVendorPurchaseDto) {
    const existing = await this.findRaw(id);

    const items = dto.items ? buildItemsWithTotals(dto.items) : existing.items;
    const totalAmount = computeTotalAmount(items);
    const dueDate = dto.dueDate !== undefined ? dto.dueDate : existing.dueDate;

    const result = await this.purchaseModel.findByIdAndUpdate(
      id,
      {
        ...dto,
        items,
        totalAmount,
        amountDue: Math.max(totalAmount - existing.amountPaid, 0),
        paymentStatus: computePaymentStatus(totalAmount, existing.amountPaid, dueDate),
      },
      { new: true, runValidators: true },
    );
    if (!result) {
      throw new NotFoundException('Purchase record not found');
    }
    return withComputedItems(result);
  }

  async remove(id: string) {
    const result = await this.purchaseModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Purchase record not found');
    }
    return { message: 'Purchase record deleted successfully' };
  }

  // Ledger: record a (partial or full) payment against a purchase order.
  async addPayment(id: string, dto: AddPaymentDto) {
    const existing = await this.findRaw(id);

    if (dto.amount > existing.amountDue) {
      throw new BadRequestException(
        `Payment amount cannot exceed the remaining due amount (${existing.amountDue}).`,
      );
    }

    existing.payments.push(dto as any);
    const amountPaid = existing.amountPaid + dto.amount;
    existing.amountPaid = amountPaid;
    existing.amountDue = Math.max(existing.totalAmount - amountPaid, 0);
    existing.paymentStatus = computePaymentStatus(existing.totalAmount, amountPaid, existing.dueDate);

    await existing.save();
    return withComputedItems(existing);
  }

  // Ledger correction: remove a mis-entered payment and recompute totals.
  async removePayment(id: string, paymentId: string) {
    const existing = await this.findRaw(id);

    const payment = (existing.payments as any).id(paymentId);
    if (!payment) {
      throw new NotFoundException('Payment entry not found');
    }
    const removedAmount = payment.amount;
    (existing.payments as any).pull(paymentId);

    const amountPaid = Math.max(existing.amountPaid - removedAmount, 0);
    existing.amountPaid = amountPaid;
    existing.amountDue = Math.max(existing.totalAmount - amountPaid, 0);
    existing.paymentStatus = computePaymentStatus(existing.totalAmount, amountPaid, existing.dueDate);

    await existing.save();
    return withComputedItems(existing);
  }

  // Purchases with at least one item whose warranty is expiring within the
  // alert window, or already expired — flattened to one entry per item so
  // the shape matches what the vendor dashboard/alerts/Header notification
  // bell already expect (a single productName + warranty per entry).
  async findExpiringWarranties(vendorId?: string) {
    // $elemMatch scopes both conditions to the SAME array element — a plain
    // { 'items.warranty.available': true, 'items.warranty.endDate': { $ne: null } }
    // filter is a classic Mongo array gotcha: $ne on an array path means "no
    // element equals this value", so a purchase with even one item that has
    // no warranty at all (endDate undefined) fails the whole document, even
    // when another item in the same order does have an expiring warranty.
    const filter: Record<string, any> = {
      items: { $elemMatch: { 'warranty.available': true, 'warranty.endDate': { $ne: null } } },
    };
    if (vendorId) filter.vendor = vendorId;

    const purchases = await this.purchaseModel.find(filter).populate('vendor', 'name category').sort({ purchaseDate: -1 });

    const flattened: any[] = [];
    purchases.forEach((purchase) => {
      const obj = purchase.toObject();
      (obj.items || []).forEach((item: any) => {
        if (!item.warranty?.available || !item.warranty?.endDate) return;
        const warrantyStatus = computeExpiryStatus(item.warranty.endDate, true);
        if (warrantyStatus === 'expiring-soon' || warrantyStatus === 'expired') {
          flattened.push({
            _id: `${obj._id}-${item._id}`,
            purchaseId: obj._id,
            productName: item.productName,
            vendor: obj.vendor,
            warranty: item.warranty,
            warrantyStatus,
          });
        }
      });
    });
    return flattened;
  }

  // Purchase orders still owed on — used by the vendor dashboard/alerts endpoints.
  async findPendingPayments(vendorId?: string) {
    const filter: Record<string, any> = { paymentStatus: { $in: ['pending', 'partial', 'overdue'] } };
    if (vendorId) filter.vendor = vendorId;

    const purchases = await this.purchaseModel.find(filter).populate('vendor', 'name category').sort({ purchaseDate: -1 });
    return purchases.map(withComputedItems);
  }

  // Aggregate stats for the vendor dashboard: total spend, vendor-wise
  // spend, category-wise counts are handled on VendorService's side (it
  // owns the Vendor collection); this covers the purchase-side numbers:
  // total purchases, total spend, pending payment total, and a monthly
  // trend for the current year.
  async getDashboardStats() {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [totals, pendingAgg, monthlyTrend, vendorSpend] = await Promise.all([
      this.purchaseModel.aggregate([
        { $group: { _id: null, totalPurchases: { $sum: 1 }, totalSpending: { $sum: '$totalAmount' } } },
      ]),
      this.purchaseModel.aggregate([
        { $match: { paymentStatus: { $in: ['pending', 'partial', 'overdue'] } } },
        { $group: { _id: null, pendingAmount: { $sum: '$amountDue' }, pendingCount: { $sum: 1 } } },
      ]),
      this.purchaseModel.aggregate([
        { $match: { purchaseDate: { $gte: yearStart } } },
        {
          $group: {
            _id: { $month: '$purchaseDate' },
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.purchaseModel.aggregate([
        { $group: { _id: '$vendor', totalSpent: { $sum: '$totalAmount' } } },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'vendors', localField: '_id', foreignField: '_id', as: 'vendorInfo' } },
        { $unwind: { path: '$vendorInfo', preserveNullAndEmptyArrays: true } },
        { $project: { vendorId: '$_id', vendorName: '$vendorInfo.name', totalSpent: 1, _id: 0 } },
      ]),
    ]);

    return {
      totalPurchases: totals[0]?.totalPurchases || 0,
      totalSpending: totals[0]?.totalSpending || 0,
      pendingPaymentAmount: pendingAgg[0]?.pendingAmount || 0,
      pendingPaymentCount: pendingAgg[0]?.pendingCount || 0,
      monthlyTrend,
      vendorWiseSpending: vendorSpend,
    };
  }
}
