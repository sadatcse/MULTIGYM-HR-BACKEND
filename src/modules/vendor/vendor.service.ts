import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor, VendorDocument } from './schemas/vendor.schema';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorPurchaseService } from '../vendor-purchase/vendor-purchase.service';
import { VendorServiceRecordService } from '../vendor-service/vendor-service.service';
import { VendorContractService } from '../vendor-contract/vendor-contract.service';
import { VendorDocumentService } from '../vendor-document/vendor-document.service';
import { VendorPerformanceService } from '../vendor-performance/vendor-performance.service';

@Injectable()
export class VendorService {
  constructor(
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
    private readonly purchaseService: VendorPurchaseService,
    private readonly serviceRecordService: VendorServiceRecordService,
    private readonly contractService: VendorContractService,
    private readonly documentService: VendorDocumentService,
    private readonly performanceService: VendorPerformanceService,
  ) {}

  async create(dto: CreateVendorDto) {
    const existing = await this.vendorModel.findOne({
      name: { $regex: new RegExp(`^${dto.name.trim()}$`, 'i') },
    });
    if (existing) {
      throw new BadRequestException(`Vendor "${dto.name}" already exists.`);
    }
    return this.vendorModel.create(dto);
  }

  async findAll(query: Record<string, any>) {
    const { search, category, status } = query;
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { 'contactPerson1.name': { $regex: search, $options: 'i' } },
        { 'contactPerson1.phone': { $regex: search, $options: 'i' } },
        { taxVatNumber: { $regex: search, $options: 'i' } },
      ];
    }
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const [totalItems, data, totalVendors, activeVendors, inactiveVendors, categoryAgg] = await Promise.all([
      this.vendorModel.countDocuments(filter),
      this.vendorModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.vendorModel.countDocuments(),
      this.vendorModel.countDocuments({ status: 'active' }),
      this.vendorModel.countDocuments({ status: 'inactive' }),
      this.vendorModel.aggregate([
        { $match: { category: { $nin: [null, ''] } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    const ratingMap = await this.performanceService.getAverageRatingMap(data.map((v) => v._id));
    const dataWithRating = data.map((v) => ({ ...v.toObject(), rating: ratingMap.get(v._id.toString()) ?? null }));

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      data: dataWithRating,
      total: totalItems,
      totalPages,
      currentPage: page,
      pageSize: limit,
      stats: {
        totalVendors,
        activeVendors,
        inactiveVendors,
        categoriesInUse: categoryAgg.length,
      },
    };
  }

  async findById(id: string) {
    const result = await this.vendorModel.findById(id);
    if (!result) {
      throw new NotFoundException('Vendor not found');
    }
    const rating = await this.performanceService.getAverageRating(id);
    return { ...result.toObject(), rating };
  }

  async update(id: string, dto: UpdateVendorDto) {
    if (dto.name) {
      const existing = await this.vendorModel.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${dto.name.trim()}$`, 'i') },
      });
      if (existing) {
        throw new BadRequestException(`Vendor "${dto.name}" already exists.`);
      }
    }
    const result = await this.vendorModel.findByIdAndUpdate(id, dto, { new: true, runValidators: true });
    if (!result) {
      throw new NotFoundException('Vendor not found');
    }
    return result;
  }

  async remove(id: string) {
    const result = await this.vendorModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Vendor not found');
    }
    return { message: 'Vendor deleted successfully' };
  }

  // 360-view aggregation: everything tied to one vendor in a single
  // response (Phase 4).
  async getFullHistory(id: string) {
    const vendor = await this.findById(id);

    const [purchasesResult, servicesResult, contractsResult, documentsResult, performanceResult] = await Promise.all([
      this.purchaseService.findAll({ vendor: id, limit: 1000 }),
      this.serviceRecordService.findAll({ vendor: id, limit: 1000 }),
      this.contractService.findAll({ vendor: id, limit: 1000 }),
      this.documentService.findAll({ vendor: id, limit: 1000 }),
      this.performanceService.findAll({ vendor: id, limit: 1000 }),
    ]);

    const purchases = purchasesResult.data;
    const totalSpend = purchases.reduce((sum: number, p: any) => sum + (p.totalAmount || 0), 0);
    const activeWarrantyCount = purchases.reduce(
      (count: number, p: any) => count + (p.items || []).filter((i: any) => i.warrantyStatus === 'active').length,
      0,
    );
    const upcomingServiceCount = servicesResult.data.filter(
      (s: any) => s.nextServiceDate && new Date(s.nextServiceDate) >= new Date(),
    ).length;

    return {
      vendor,
      purchases,
      services: servicesResult.data,
      contracts: contractsResult.data,
      documents: documentsResult.data,
      performanceReviews: performanceResult.data,
      stats: {
        totalSpend,
        totalPurchases: purchases.length,
        activeWarrantyCount,
        upcomingServiceCount,
        totalContracts: contractsResult.data.length,
      },
    };
  }

  // Vendor dashboard (Phase 5): counts owned by this service (vendors,
  // categories) merged with purchase-side spend/trend numbers and
  // cross-module expiring/upcoming counts.
  async getDashboardStats() {
    const [
      totalVendors,
      activeVendors,
      inactiveVendors,
      categoryBreakdown,
      purchaseStats,
      expiringWarranties,
      expiringContracts,
      upcomingServices,
    ] = await Promise.all([
      this.vendorModel.countDocuments(),
      this.vendorModel.countDocuments({ status: 'active' }),
      this.vendorModel.countDocuments({ status: 'inactive' }),
      this.vendorModel.aggregate([
        { $match: { category: { $nin: [null, ''] } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $project: { category: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } },
      ]),
      this.purchaseService.getDashboardStats(),
      this.purchaseService.findExpiringWarranties(),
      this.contractService.findExpiring(),
      this.serviceRecordService.findUpcoming(30),
    ]);

    const expiredContracts = expiringContracts.filter((c: any) => c.status === 'expired').length;

    return {
      totalVendors,
      activeVendors,
      inactiveVendors,
      totalPurchases: purchaseStats.totalPurchases,
      totalSpending: purchaseStats.totalSpending,
      pendingPaymentAmount: purchaseStats.pendingPaymentAmount,
      pendingPaymentCount: purchaseStats.pendingPaymentCount,
      expiringWarrantiesCount: expiringWarranties.length,
      upcomingServicesCount: upcomingServices.length,
      expiredContractsCount: expiredContracts,
      categoryWiseVendors: categoryBreakdown,
      vendorWiseSpending: purchaseStats.vendorWiseSpending,
      monthlyPurchaseTrend: purchaseStats.monthlyTrend,
    };
  }

  // Live-computed reminders (Phase 5) — the actual item lists, not just
  // counts, for a dashboard alerts panel / notification bell.
  async getAlerts() {
    const [expiringWarranties, expiringContracts, upcomingServices, pendingPayments] = await Promise.all([
      this.purchaseService.findExpiringWarranties(),
      this.contractService.findExpiring(),
      this.serviceRecordService.findUpcoming(30),
      this.purchaseService.findPendingPayments(),
    ]);

    return {
      expiringWarranties,
      expiringContracts,
      upcomingServices,
      pendingPayments,
    };
  }
}
