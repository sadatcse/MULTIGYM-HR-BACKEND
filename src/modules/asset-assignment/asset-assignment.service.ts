import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AssetAssignment, AssetAssignmentDocument } from './schemas/asset-assignment.schema';
import { Asset, AssetDocument } from '../asset/schemas/asset.schema';
import { AssetType, AssetTypeDocument } from '../asset-type/schemas/asset-type.schema';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { IssueAssetDto } from './dto/issue-asset.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';

const ASSET_POPULATE = { path: 'asset', populate: { path: 'assetType', select: 'name category trackingType returnable replacementIntervalMonths' } };
const EMPLOYEE_POPULATE = { path: 'employee', select: 'name employeeId photo department status' };

@Injectable()
export class AssetAssignmentService {
  constructor(
    @InjectModel(AssetAssignment.name) private readonly assignmentModel: Model<AssetAssignmentDocument>,
    @InjectModel(Asset.name) private readonly assetModel: Model<AssetDocument>,
    @InjectModel(AssetType.name) private readonly assetTypeModel: Model<AssetTypeDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
  ) {}

  async issue(dto: IssueAssetDto) {
    const employeeExists = await this.employeeModel.exists({ _id: dto.employee });
    if (!employeeExists) {
      throw new BadRequestException('Employee not found');
    }

    const asset = await this.assetModel.findById(dto.asset);
    if (!asset) {
      throw new BadRequestException('Asset not found');
    }

    const assetType = await this.assetTypeModel.findById(asset.assetType);
    const quantity = dto.quantity ?? 1;

    const activeAgg = await this.assignmentModel.aggregate([
      { $match: { asset: asset._id, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]);
    const alreadyAssigned = activeAgg[0]?.total || 0;

    if (assetType?.trackingType === 'individual') {
      if (alreadyAssigned > 0) {
        throw new BadRequestException(`Asset "${asset.assetCode}" is already assigned to someone.`);
      }
    } else {
      const available = asset.quantityTotal - alreadyAssigned;
      if (quantity > available) {
        throw new BadRequestException(`Only ${available} unit(s) of "${asset.assetCode}" are available.`);
      }
    }

    const created = await this.assignmentModel.create({ ...dto, quantity });

    // Individual assets flip to 'assigned' while actively held; an inventory
    // SKU's own status field stays as-is — its real availability is the
    // computed quantityAvailable on the Asset record, not this field.
    if (assetType?.trackingType === 'individual') {
      asset.status = 'assigned';
      await asset.save();
    }

    return this.assignmentModel.findById(created._id).populate(EMPLOYEE_POPULATE).populate(ASSET_POPULATE);
  }

  async findAll(query: Record<string, any>) {
    const { employee, asset, status } = query;
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (employee) filter.employee = employee;
    if (asset) filter.asset = asset;
    if (status && status !== 'all') filter.status = status;

    const [totalItems, data] = await Promise.all([
      this.assignmentModel.countDocuments(filter),
      this.assignmentModel
        .find(filter)
        .populate(EMPLOYEE_POPULATE)
        .populate(ASSET_POPULATE)
        .sort({ issueDate: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return {
      data,
      total: totalItems,
      totalPages: Math.ceil(totalItems / limit) || 1,
      currentPage: page,
      pageSize: limit,
    };
  }

  async findByEmployee(employeeId: string) {
    return this.assignmentModel.find({ employee: employeeId }).populate(ASSET_POPULATE).sort({ issueDate: -1 });
  }

  async findByAsset(assetId: string) {
    return this.assignmentModel.find({ asset: assetId }).populate(EMPLOYEE_POPULATE).sort({ issueDate: -1 });
  }

  async returnAsset(id: string, dto: ReturnAssetDto) {
    const assignment = await this.assignmentModel.findById(id);
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (assignment.status === 'returned') {
      throw new BadRequestException('This item has already been returned.');
    }

    assignment.status = 'returned';
    assignment.returnDate = new Date(dto.returnDate);
    assignment.returnCondition = dto.returnCondition;
    assignment.returnedTo = dto.returnedTo;
    assignment.returnNotes = dto.returnNotes;
    assignment.damageOrLoss = dto.damageOrLoss || 'none';
    await assignment.save();

    const asset = await this.assetModel.findById(assignment.asset);
    if (asset) {
      const assetType = await this.assetTypeModel.findById(asset.assetType);
      if (assetType?.trackingType === 'individual') {
        asset.status = assignment.damageOrLoss === 'damaged' ? 'damaged' : assignment.damageOrLoss === 'lost' ? 'lost' : 'available';
        await asset.save();
      }
    }

    return this.assignmentModel.findById(id).populate(EMPLOYEE_POPULATE).populate(ASSET_POPULATE);
  }

  // Exit Clearance (section 9): active, RETURNABLE assignments belonging to
  // resigned/terminated employees. "Cleared" = zero results for that employee.
  async findPendingReturns(employeeId?: string) {
    const filter: Record<string, any> = { status: 'active' };
    if (employeeId) filter.employee = employeeId;

    const assignments = await this.assignmentModel.find(filter).populate(EMPLOYEE_POPULATE).populate(ASSET_POPULATE).sort({ issueDate: 1 });

    return assignments.filter((a: any) => {
      const emp = a.employee;
      const returnable = a.asset?.assetType?.returnable !== false;
      return returnable && emp && ['resigned', 'terminated'].includes(emp.status);
    });
  }

  async getDashboardStats() {
    const [statusAgg, categoryAgg, totalAssets] = await Promise.all([
      this.assetModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.assetModel.aggregate([
        { $lookup: { from: 'assettypes', localField: 'assetType', foreignField: '_id', as: 'type' } },
        { $unwind: '$type' },
        { $group: { _id: '$type.category', count: { $sum: 1 } } },
        { $project: { category: '$_id', count: 1, _id: 0 } },
      ]),
      this.assetModel.countDocuments(),
    ]);

    const statusMap: Record<string, number> = Object.fromEntries(statusAgg.map((s) => [s._id, s.count]));

    return {
      totalAssets,
      assigned: statusMap.assigned || 0,
      available: statusMap.available || 0,
      damaged: statusMap.damaged || 0,
      lost: statusMap.lost || 0,
      repair: statusMap.repair || 0,
      disposed: statusMap.disposed || 0,
      categoryDistribution: categoryAgg,
    };
  }

  // Phase 4 alerts: pending returns + damaged/lost assets + replacement due.
  async getAlerts() {
    const [pendingReturns, damagedAssets, activeAssignments] = await Promise.all([
      this.findPendingReturns(),
      this.assetModel.find({ status: { $in: ['damaged', 'lost'] } }).populate('assetType', 'name category'),
      this.assignmentModel.find({ status: 'active' }).populate('employee', 'name').populate(ASSET_POPULATE),
    ]);

    const now = new Date();
    const replacementDue = activeAssignments.filter((a: any) => {
      const months = a.asset?.assetType?.replacementIntervalMonths;
      if (!months) return false;
      const dueDate = new Date(a.issueDate);
      dueDate.setMonth(dueDate.getMonth() + months);
      return dueDate <= now;
    });

    return { pendingReturns, damagedAssets, replacementDue };
  }
}
