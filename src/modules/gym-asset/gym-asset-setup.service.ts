import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { GymAssetCoreService } from './gym-asset-core.service';
import { CreateCategoryDto, CreateLocationDto, CreatePlaceDto, UpdateCategoryDto, UpdateLocationDto, UpdatePlaceDto } from './dto/gym-asset.dto';

const CI = { locale: 'en', strength: 2 }; // case-insensitive name matching

// Locations, the places inside them, and asset categories.
@Injectable()
export class GymAssetSetupService {
  constructor(private readonly core: GymAssetCoreService) {}

  private async countBy(field: 'place' | 'category') {
    const rows = await this.core.assetModel.aggregate([{ $group: { _id: { id: `$${field}`, status: '$status' }, lines: { $sum: 1 }, units: { $sum: '$quantity' } } }]);
    const out = new Map<string, { active: number; disposed: number; units: number }>();
    for (const r of rows) {
      const key = String(r._id.id);
      const c = out.get(key) || { active: 0, disposed: 0, units: 0 };
      if (r._id.status === 'disposed') c.disposed += r.lines;
      else {
        c.active += r.lines;
        c.units += r.units;
      }
      out.set(key, c);
    }
    return out;
  }

  // ---------------------------------------------------------------- locations
  async listLocations(q: Record<string, any>) {
    const filter: Record<string, any> = {};
    if (q.status && q.status !== 'all') filter.status = q.status;
    const [locations, places, assets] = await Promise.all([
      this.core.locationModel.find(filter).sort({ name: 1 }).collation(CI).lean(),
      this.core.placeModel.aggregate([{ $group: { _id: '$location', places: { $sum: 1 } } }]),
      this.core.assetModel.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$location', lines: { $sum: 1 }, units: { $sum: '$quantity' }, value: { $sum: { $multiply: ['$unitPrice', '$quantity'] } } } },
      ]),
    ]);
    const placeCount = new Map(places.map((p) => [String(p._id), p.places as number]));
    const assetCount = new Map(assets.map((a) => [String(a._id), { lines: a.lines, units: a.units, value: Math.round(a.value * 100) / 100 }]));
    return locations.map((l) => ({ ...l, places: placeCount.get(String(l._id)) || 0, assets: assetCount.get(String(l._id)) || { lines: 0, units: 0, value: 0 } }));
  }

  async createLocation(dto: CreateLocationDto) {
    const name = dto.name.trim();
    await this.assertLocationUnique(name);
    return this.core.locationModel.create({
      name,
      type: dto.type || 'branch',
      address: (dto.address || '').trim(),
      contactPerson: (dto.contactPerson || '').trim(),
      contactNumber: (dto.contactNumber || '').trim(),
      status: dto.status || 'active',
    });
  }

  async updateLocation(id: string, dto: UpdateLocationDto) {
    const loc = Types.ObjectId.isValid(id) ? await this.core.locationModel.findById(id) : null;
    if (!loc) throw new NotFoundException('Location not found');
    if (dto.name !== undefined && dto.name.trim().toLowerCase() !== loc.name.toLowerCase()) await this.assertLocationUnique(dto.name.trim(), id);
    if (dto.name !== undefined) loc.name = dto.name.trim();
    for (const k of ['address', 'contactPerson', 'contactNumber'] as const) {
      if (dto[k] !== undefined) loc[k] = dto[k].trim();
    }
    if (dto.type) loc.type = dto.type;
    if (dto.status) loc.status = dto.status;
    return loc.save();
  }

  async removeLocation(id: string) {
    const loc = Types.ObjectId.isValid(id) ? await this.core.locationModel.findById(id).select('name').lean() : null;
    if (!loc) throw new NotFoundException('Location not found');
    const [assets, places] = await Promise.all([this.core.assetModel.countDocuments({ location: loc._id }), this.core.placeModel.countDocuments({ location: loc._id })]);
    if (assets) throw new BadRequestException(`${assets} asset record${assets > 1 ? 's point' : ' points'} to ${loc.name}, so it is kept. Mark it inactive instead.`);
    if (places) throw new BadRequestException(`${loc.name} has ${places} place${places > 1 ? 's' : ''}. Delete ${places > 1 ? 'them' : 'it'} first, or mark the location inactive.`);
    await this.core.locationModel.deleteOne({ _id: loc._id });
    return { message: 'Location deleted' };
  }

  private async assertLocationUnique(name: string, exceptId?: string) {
    const clash = await this.core.locationModel
      .findOne({ name, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
      .collation(CI)
      .lean();
    if (clash) throw new BadRequestException(`A location named "${clash.name}" already exists`);
  }

  /** Names already used in this module, for the free-text person / supplier boxes. */
  async suggestions() {
    const clean = (list: unknown[]) => [...new Set(list.map((x) => String(x || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)).slice(0, 300);
    const [responsible, suppliers, approvers, recorders, providers] = await Promise.all([
      this.core.assetModel.distinct('responsiblePerson'),
      this.core.assetModel.distinct('supplier'),
      this.core.connection.collection('gym_asset_disposals').distinct('approvedBy.name'),
      Promise.all([
        this.core.connection.collection('gym_asset_transfers').distinct('by.name'),
        this.core.connection.collection('gym_asset_maintenance').distinct('by.name'),
      ]).then((x) => x.flat()),
      this.core.connection.collection('gym_asset_maintenance').distinct('serviceProvider'),
    ]);
    return { responsible: clean(responsible), suppliers: clean(suppliers), approvers: clean(approvers), recordedBy: clean(recorders), serviceProviders: clean(providers) };
  }

  // ---------------------------------------------------------------- places
  async listPlaces(q: Record<string, any>) {
    const filter: Record<string, any> = {};
    if (q.location && q.location !== 'all') {
      if (!Types.ObjectId.isValid(q.location)) throw new BadRequestException('Invalid location');
      filter.location = q.location;
    }
    if (q.status && q.status !== 'all') filter.status = q.status;
    const [places, counts] = await Promise.all([this.core.placeModel.find(filter).sort({ name: 1 }).collation(CI).lean(), this.countBy('place')]);
    return places.map((p) => ({ ...p, assets: counts.get(String(p._id)) || { active: 0, disposed: 0, units: 0 } }));
  }

  async createPlace(dto: CreatePlaceDto) {
    const location = Types.ObjectId.isValid(dto.location) ? await this.core.locationModel.findById(dto.location).select('name').lean() : null;
    if (!location) throw new BadRequestException('That location no longer exists');
    const name = dto.name.trim();
    await this.assertPlaceUnique(dto.location, name);
    return this.core.placeModel.create({ location: dto.location, name, description: (dto.description || '').trim(), status: dto.status || 'active' });
  }

  async updatePlace(id: string, dto: UpdatePlaceDto) {
    const place = Types.ObjectId.isValid(id) ? await this.core.placeModel.findById(id) : null;
    if (!place) throw new NotFoundException('Place not found');
    const location = dto.location || String(place.location);
    if (location !== String(place.location)) {
      const used = await this.core.assetModel.countDocuments({ place: place._id });
      if (used) throw new BadRequestException(`${used} asset${used > 1 ? 's are' : ' is'} recorded in ${place.name}; transfer them before moving the place to another location`);
      if (!(await this.core.locationModel.exists({ _id: location }))) throw new BadRequestException('That location no longer exists');
    }
    const name = dto.name !== undefined ? dto.name.trim() : place.name;
    if (name.toLowerCase() !== place.name.toLowerCase() || location !== String(place.location)) await this.assertPlaceUnique(location, name, id);
    place.set({ location, name });
    if (dto.description !== undefined) place.description = dto.description.trim();
    if (dto.status) place.status = dto.status;
    return place.save();
  }

  async removePlace(id: string) {
    const place = Types.ObjectId.isValid(id) ? await this.core.placeModel.findById(id).select('name').lean() : null;
    if (!place) throw new NotFoundException('Place not found');
    const [active, disposed] = await Promise.all([
      this.core.assetModel.countDocuments({ place: place._id, status: 'active' }),
      this.core.assetModel.countDocuments({ place: place._id, status: 'disposed' }),
    ]);
    if (active) throw new BadRequestException(`${active} asset${active > 1 ? 's are' : ' is'} in ${place.name}. Transfer ${active > 1 ? 'them' : 'it'} first, or mark the place inactive.`);
    if (disposed) throw new BadRequestException(`Disposed assets still point to ${place.name}, so it is kept for their records. Mark it inactive instead.`);
    await this.core.placeModel.deleteOne({ _id: place._id });
    return { message: 'Place deleted' };
  }

  private async assertPlaceUnique(location: string, name: string, exceptId?: string) {
    const clash = await this.core.placeModel
      .findOne({ location, name, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
      .collation(CI)
      .lean();
    if (clash) throw new BadRequestException(`"${clash.name}" already exists in this location`);
  }

  // ---------------------------------------------------------------- categories
  async listCategories(q: Record<string, any>) {
    const filter: Record<string, any> = {};
    if (q.status && q.status !== 'all') filter.status = q.status;
    const [cats, counts] = await Promise.all([this.core.categoryModel.find(filter).sort({ name: 1 }).collation(CI).lean(), this.countBy('category')]);
    return cats.map((c) => ({ ...c, assets: counts.get(String(c._id)) || { active: 0, disposed: 0, units: 0 } }));
  }

  async createCategory(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    await this.assertCategoryUnique(name);
    return this.core.categoryModel.create({ name, description: (dto.description || '').trim(), depreciationRate: dto.depreciationRate ?? 0, status: dto.status || 'active' });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const cat = Types.ObjectId.isValid(id) ? await this.core.categoryModel.findById(id) : null;
    if (!cat) throw new NotFoundException('Category not found');
    if (dto.name !== undefined && dto.name.trim().toLowerCase() !== cat.name.toLowerCase()) await this.assertCategoryUnique(dto.name.trim(), id);
    if (dto.name !== undefined) cat.name = dto.name.trim();
    if (dto.description !== undefined) cat.description = dto.description.trim();
    if (dto.depreciationRate !== undefined) cat.depreciationRate = dto.depreciationRate;
    if (dto.status) cat.status = dto.status;
    return cat.save();
  }

  async removeCategory(id: string) {
    const cat = Types.ObjectId.isValid(id) ? await this.core.categoryModel.findById(id).select('name').lean() : null;
    if (!cat) throw new NotFoundException('Category not found');
    const used = await this.core.assetModel.countDocuments({ category: cat._id });
    if (used) throw new BadRequestException(`${used} asset${used > 1 ? 's use' : ' uses'} "${cat.name}", so it can't be deleted. Mark it inactive to stop it being picked for new assets.`);
    await this.core.categoryModel.deleteOne({ _id: cat._id });
    return { message: 'Category deleted' };
  }

  private async assertCategoryUnique(name: string, exceptId?: string) {
    const clash = await this.core.categoryModel
      .findOne({ name, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
      .collation(CI)
      .lean();
    if (clash) throw new BadRequestException(`A category named "${clash.name}" already exists`);
  }
}
