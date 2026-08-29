import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorPurchase, VendorPurchaseDocument } from './schemas/vendor-purchase.schema';
import { Vendor, VendorDocument } from '../vendor/schemas/vendor.schema';
import { CreateVendorPurchaseDto } from './dto/create-vendor-purchase.dto';
import { UpdateVendorPurchaseDto } from './dto/update-vendor-purchase.dto';
import { computeExpiryStatus } from '../../common/helpers/expiry-status.helper';

function withWarrantyStatus(purchase: any) {
  const obj = purchase.toObject ? purchase.toObject() : purchase;
  return {
    ...obj,
    warrantyStatus: computeExpiryStatus(obj.warranty?.endDate, !!obj.warranty?.available),
  };
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

    const quantity = dto.quantity ?? 1;
    const created = await this.purchaseModel.create({
      ...dto,
      quantity,
      totalPrice: quantity * dto.unitPrice,
    });
    return withWarrantyStatus(created);
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
        { productName: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { productCategory: { $regex: search, $options: 'i' } },
        { 'warranty.serialNumber': { $regex: search, $options: 'i' } },
        { 'warranty.assetId': { $regex: search, $options: 'i' } },
      ];
    }

    const [totalItems, data] = await Promise.all([
      this.purchaseModel.countDocuments(filter),
      this.purchaseModel.find(filter).sort({ purchaseDate: -1 }).skip(skip).limit(limit),
    ]);

    let items = data.map(withWarrantyStatus);
    if (warrantyStatus && warrantyStatus !== 'all') {
      items = items.filter((p) => p.warrantyStatus === warrantyStatus);
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
    return withWarrantyStatus(result);
  }

  async update(id: string, dto: UpdateVendorPurchaseDto) {
    const existing = await this.purchaseModel.findById(id);
    if (!existing) {
      throw new NotFoundException('Purchase record not found');
    }

    const quantity = dto.quantity ?? existing.quantity;
    const unitPrice = dto.unitPrice ?? existing.unitPrice;

    const result = await this.purchaseModel.findByIdAndUpdate(
      id,
      { ...dto, totalPrice: quantity * unitPrice },
      { new: true, runValidators: true },
    );
    if (!result) {
      throw new NotFoundException('Purchase record not found');
    }
    return withWarrantyStatus(result);
  }

  async remove(id: string) {
    const result = await this.purchaseModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Purchase record not found');
    }
    return { message: 'Purchase record deleted successfully' };
  }

  // Purchases whose warranty is expiring within the alert window, or already
  // expired — used by the vendor dashboard/alerts endpoints (Phase 5).
  async findExpiringWarranties(vendorId?: string) {
    const filter: Record<string, any> = { 'warranty.available': true, 'warranty.endDate': { $ne: null } };
    if (vendorId) filter.vendor = vendorId;

    const purchases = await this.purchaseModel.find(filter).populate('vendor', 'name category').sort({ 'warranty.endDate': 1 });
    return purchases
      .map(withWarrantyStatus)
      .filter((p) => p.warrantyStatus === 'expiring-soon' || p.warrantyStatus === 'expired');
  }

  // Purchases still owed on — used by the vendor dashboard/alerts endpoints
  // (Phase 5).
  async findPendingPayments(vendorId?: string) {
    const filter: Record<string, any> = { paymentStatus: { $in: ['pending', 'partial', 'overdue'] } };
    if (vendorId) filter.vendor = vendorId;

    const purchases = await this.purchaseModel.find(filter).populate('vendor', 'name category').sort({ purchaseDate: -1 });
    return purchases.map(withWarrantyStatus);
  }

  // Aggregate stats for the vendor dashboard (Phase 5): total spend,
  // vendor-wise spend, category-wise counts are handled on VendorService's
  // side (it owns the Vendor collection); this covers the purchase-side
  // numbers: total purchases, total spend, pending payment total, and a
  // monthly trend for the current year.
  async getDashboardStats() {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [totals, pendingAgg, monthlyTrend, vendorSpend] = await Promise.all([
      this.purchaseModel.aggregate([
        { $group: { _id: null, totalPurchases: { $sum: 1 }, totalSpending: { $sum: '$totalPrice' } } },
      ]),
      this.purchaseModel.aggregate([
        { $match: { paymentStatus: { $in: ['pending', 'partial', 'overdue'] } } },
        { $group: { _id: null, pendingAmount: { $sum: '$totalPrice' }, pendingCount: { $sum: 1 } } },
      ]),
      this.purchaseModel.aggregate([
        { $match: { purchaseDate: { $gte: yearStart } } },
        {
          $group: {
            _id: { $month: '$purchaseDate' },
            total: { $sum: '$totalPrice' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.purchaseModel.aggregate([
        { $group: { _id: '$vendor', totalSpent: { $sum: '$totalPrice' } } },
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
