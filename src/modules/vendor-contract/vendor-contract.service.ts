import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorContract, VendorContractDocument } from './schemas/vendor-contract.schema';
import { Vendor, VendorDocument } from '../vendor/schemas/vendor.schema';
import { CreateVendorContractDto } from './dto/create-vendor-contract.dto';
import { UpdateVendorContractDto } from './dto/update-vendor-contract.dto';
import { computeExpiryStatus } from '../../common/helpers/expiry-status.helper';

// Active/expiring/expired are always recomputed live from endDate; a manual
// "terminated" call is the one status that's preserved as stored.
function withComputedStatus(contract: any) {
  const obj = contract.toObject ? contract.toObject() : contract;
  if (obj.status === 'terminated') return obj;

  const computed = computeExpiryStatus(obj.endDate, true);
  const status = computed === 'expiring-soon' ? 'expiring' : computed === 'none' ? 'active' : computed;
  return { ...obj, status };
}

@Injectable()
export class VendorContractService {
  constructor(
    @InjectModel(VendorContract.name) private readonly contractModel: Model<VendorContractDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
  ) {}

  async create(dto: CreateVendorContractDto) {
    const vendorExists = await this.vendorModel.exists({ _id: dto.vendor });
    if (!vendorExists) {
      throw new BadRequestException('Vendor not found');
    }
    const created = await this.contractModel.create(dto);
    return withComputedStatus(created);
  }

  async findAll(query: Record<string, any>) {
    const { vendor, search, status } = query;
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (vendor) filter.vendor = vendor;
    if (search) {
      filter.$or = [
        { contractType: { $regex: search, $options: 'i' } },
        { contractNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const [totalItems, data] = await Promise.all([
      this.contractModel.countDocuments(filter),
      this.contractModel.find(filter).sort({ endDate: -1 }).skip(skip).limit(limit),
    ]);

    let items = data.map(withComputedStatus);
    if (status && status !== 'all') {
      items = items.filter((c) => c.status === status);
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
    const result = await this.contractModel.findById(id);
    if (!result) {
      throw new NotFoundException('Contract not found');
    }
    return withComputedStatus(result);
  }

  async update(id: string, dto: UpdateVendorContractDto) {
    const result = await this.contractModel.findByIdAndUpdate(id, dto, { new: true, runValidators: true });
    if (!result) {
      throw new NotFoundException('Contract not found');
    }
    return withComputedStatus(result);
  }

  async remove(id: string) {
    const result = await this.contractModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Contract not found');
    }
    return { message: 'Contract deleted successfully' };
  }

  async findExpiring(vendorId?: string) {
    const filter: Record<string, any> = { status: { $ne: 'terminated' } };
    if (vendorId) filter.vendor = vendorId;

    const contracts = await this.contractModel.find(filter).populate('vendor', 'name category').sort({ endDate: 1 });
    return contracts.map(withComputedStatus).filter((c) => c.status === 'expiring' || c.status === 'expired');
  }
}
