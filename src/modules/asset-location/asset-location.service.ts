import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AssetLocation, AssetLocationDocument } from './schemas/asset-location.schema';
import { Asset, AssetDocument } from '../asset/schemas/asset.schema';
import { AssetAssignment, AssetAssignmentDocument } from '../asset-assignment/schemas/asset-assignment.schema';
import { CreateAssetLocationDto } from './dto/create-asset-location.dto';
import { UpdateAssetLocationDto } from './dto/update-asset-location.dto';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const emptyStock = () => ({ items: 0, units: 0, inStore: 0, issued: 0, lowStock: 0 });
type Stock = ReturnType<typeof emptyStock>;

@Injectable()
export class AssetLocationService {
  constructor(
    @InjectModel(AssetLocation.name) private readonly locationModel: Model<AssetLocationDocument>,
    @InjectModel(Asset.name) private readonly assetModel: Model<AssetDocument>,
    @InjectModel(AssetAssignment.name) private readonly assignmentModel: Model<AssetAssignmentDocument>,
  ) {}

  private async assertUnique(name: string, branch: string, exceptId?: string) {
    const clash = await this.locationModel
      .findOne({
        ...(exceptId ? { _id: { $ne: exceptId } } : {}),
        name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
        branch,
      })
      .lean();
    if (clash) throw new BadRequestException(`"${clash.name}" already exists${branch ? ` in ${branch}` : ''}.`);
  }

  // What each location holds, counted the same way as the asset list:
  // in store = total stock minus what active assignments hold. Key '' collects
  // assets that have no location yet.
  private async stockByLocation() {
    const [assets, assigned] = await Promise.all([
      this.assetModel.find().select('location quantityTotal minStockThreshold').lean(),
      this.assignmentModel.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$asset', total: { $sum: '$quantity' } } }]),
    ]);
    const issuedOf = new Map(assigned.map((a) => [String(a._id), a.total as number]));
    const byLocation = new Map<string, Stock>();
    for (const a of assets) {
      const key = a.location ? String(a.location) : '';
      const s = byLocation.get(key) || emptyStock();
      const issued = issuedOf.get(String(a._id)) || 0;
      const inStore = Math.max((a.quantityTotal || 0) - issued, 0);
      s.items += 1;
      s.units += a.quantityTotal || 0;
      s.issued += issued;
      s.inStore += inStore;
      if (inStore <= (a.minStockThreshold || 0)) s.lowStock += 1;
      byLocation.set(key, s);
    }
    return byLocation;
  }

  async findAll(query: Record<string, any>) {
    const filter: Record<string, any> = {};
    if (query.status && query.status !== 'all') filter.status = query.status;
    if (query.branch && query.branch !== 'all') filter.branch = query.branch === 'none' ? '' : query.branch;
    if (query.search?.trim()) {
      const re = { $regex: escapeRegex(query.search.trim()), $options: 'i' };
      filter.$or = [{ name: re }, { details: re }, { branch: re }];
    }
    const [locations, stock] = await Promise.all([
      this.locationModel.find(filter).populate('inCharge', 'name employeeId photo mobileNumber jobPosition').sort({ branch: 1, name: 1 }).lean(),
      this.stockByLocation(),
    ]);
    return {
      data: locations.map((l) => ({ ...l, stock: stock.get(String(l._id)) || emptyStock() })),
      unplaced: stock.get('') || emptyStock(),
    };
  }

  async create(dto: CreateAssetLocationDto) {
    const name = dto.name.trim();
    const branch = (dto.branch || '').trim();
    await this.assertUnique(name, branch);
    return this.locationModel.create({
      name,
      branch,
      details: (dto.details || '').trim(),
      inCharge: dto.inCharge || null,
      status: dto.status || 'active',
    });
  }

  async update(id: string, dto: UpdateAssetLocationDto) {
    const current = Types.ObjectId.isValid(id) ? await this.locationModel.findById(id) : null;
    if (!current) throw new NotFoundException('Location not found');
    const name = dto.name !== undefined ? dto.name.trim() : current.name;
    const branch = dto.branch !== undefined ? dto.branch.trim() : current.branch;
    if (name.toLowerCase() !== current.name.toLowerCase() || branch !== current.branch) await this.assertUnique(name, branch, id);

    current.name = name;
    current.branch = branch;
    if (dto.details !== undefined) current.details = dto.details.trim();
    if (dto.inCharge !== undefined) current.inCharge = dto.inCharge ? new Types.ObjectId(dto.inCharge) : null;
    if (dto.status) current.status = dto.status;
    await current.save();
    return current.populate('inCharge', 'name employeeId photo mobileNumber jobPosition');
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Location not found');
    const stored = await this.assetModel.countDocuments({ location: id });
    if (stored) {
      throw new BadRequestException(`${stored} item${stored > 1 ? 's are' : ' is'} still stored here. Move ${stored > 1 ? 'them' : 'it'} to another location first.`);
    }
    const result = await this.locationModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Location not found');
    return { message: 'Location deleted' };
  }
}
