import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AssetAssignment, AssetAssignmentDocument } from './schemas/asset-assignment.schema';
import { Asset, AssetDocument } from '../asset/schemas/asset.schema';
import { AssetType, AssetTypeDocument } from '../asset-type/schemas/asset-type.schema';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { IssueAssetDto } from './dto/issue-asset.dto';
import { BulkIssueAssetDto } from './dto/bulk-issue-asset.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { AssetTransactionService } from '../asset-transaction/asset-transaction.service';

const ASSET_POPULATE = {
  path: 'asset',
  populate: { path: 'assetType', select: 'name category trackingType returnable requiresSize requiresSerialNumber replacementIntervalMonths' },
};
const EMPLOYEE_POPULATE = { path: 'employee', select: 'name employeeId photo department branch designation status' };

@Injectable()
export class AssetAssignmentService implements OnModuleInit {
  constructor(
    @InjectModel(AssetAssignment.name) private readonly assignmentModel: Model<AssetAssignmentDocument>,
    @InjectModel(Asset.name) private readonly assetModel: Model<AssetDocument>,
    @InjectModel(AssetType.name) private readonly assetTypeModel: Model<AssetTypeDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    private readonly transactionService: AssetTransactionService,
  ) {}

  async onModuleInit() {
    await this.backfillHistoricalSnapshots();
  }

  /**
   * Database Safety Migration:
   * Populate missing employeeName, employeeCode, departmentName, branchName
   * for historical assignment records so deleting an employee never breaks audit history.
   */
  async backfillHistoricalSnapshots() {
    try {
      const missingSnapshots = await this.assignmentModel
        .find({
          $or: [
            { employeeName: { $exists: false } },
            { employeeName: null },
            { employeeName: '' },
          ],
        })
        .populate('employee');

      for (const assignment of missingSnapshots) {
        const emp: any = assignment.employee;
        if (emp) {
          assignment.employeeName = emp.name || 'Unknown Employee';
          assignment.employeeCode = emp.employeeId || 'N/A';
          assignment.departmentName = typeof emp.department === 'string' ? emp.department : emp.department?.name || 'N/A';
          assignment.designationName = typeof emp.jobPosition === 'string' ? emp.jobPosition : emp.jobPosition?.name || (emp as any).designation || 'N/A';
          assignment.branchName = Array.isArray(emp.branches) && emp.branches.length > 0 ? emp.branches[0] : 'N/A';
        } else {
          assignment.employeeName = 'Archived Employee';
          assignment.employeeCode = 'N/A';
        }
        if (!assignment.quantityPending) {
          assignment.quantityPending = Math.max((assignment.quantity || 1) - (assignment.quantityReturned || 0), 0);
        }
        await assignment.save();
      }
    } catch (err) {
      console.error('Error in AssetAssignment backfill migration:', err.message);
    }
  }

  async issue(dto: IssueAssetDto) {
    const employee = await this.employeeModel.findById(dto.employee).exec();
    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

    const asset = await this.assetModel.findById(dto.asset);
    if (!asset) {
      throw new BadRequestException('Asset not found');
    }

    const assetType = await this.assetTypeModel.findById(asset.assetType);
    const quantity = dto.quantity ?? 1;
    const sizeRequested = dto.size || asset.size || (asset.sizeVariants?.[0]?.size ?? 'N/A');

    // 1. Stock Validation
    const isSingleUniqueAsset = (assetType?.trackingType === 'individual' || (asset as any).trackingType === 'individual') && (asset.quantityTotal || 1) <= 1;

    if (isSingleUniqueAsset) {
      const activeCount = await this.assignmentModel.countDocuments({ asset: asset._id, status: 'active' });
      if (activeCount > 0) {
        throw new BadRequestException(`Asset "${asset.assetCode}" is currently assigned to someone.`);
      }
    } else if (asset.sizeVariants && asset.sizeVariants.length > 0 && sizeRequested !== 'N/A') {
      const variant = asset.sizeVariants.find(
        (v) =>
          v.size === sizeRequested ||
          v.variantName === sizeRequested ||
          (v.size && sizeRequested && v.size.trim().toLowerCase() === sizeRequested.trim().toLowerCase()) ||
          (v.variantName && sizeRequested && v.variantName.trim().toLowerCase() === sizeRequested.trim().toLowerCase())
      ) || asset.sizeVariants[0];

      if (!variant) {
        throw new BadRequestException(`Size variant "${sizeRequested}" does not exist for asset "${asset.assetCode}".`);
      }

      const availableQty = typeof variant.quantityAvailable === 'number' ? variant.quantityAvailable : (variant.quantityTotal || 0);
      if (quantity > availableQty) {
        throw new BadRequestException(`Only ${availableQty} unit(s) of size/variant "${variant.variantName || variant.size}" are available for "${asset.assetCode}".`);
      }

      // Update variant stock
      variant.quantityAvailable = Math.max(availableQty - quantity, 0);
      variant.quantityAssigned = (variant.quantityAssigned || 0) + quantity;
      asset.quantityAssigned = (asset.quantityAssigned || 0) + quantity;
      asset.quantityAvailable = Math.max((asset.quantityTotal || 0) - asset.quantityAssigned, 0);
      asset.isLowStock = asset.quantityAvailable <= (asset.minStockThreshold || 0);
      asset.markModified('sizeVariants');
      await asset.save();
    } else {
      const activeAgg = await this.assignmentModel.aggregate([
        { $match: { asset: asset._id, status: 'active' } },
        { $group: { _id: null, total: { $sum: '$quantityPending' } } },
      ]);
      const alreadyAssigned = activeAgg[0]?.total || 0;
      const available = asset.quantityTotal - alreadyAssigned;
      if (quantity > available) {
        throw new BadRequestException(`Only ${available} unit(s) of "${asset.assetCode}" are available.`);
      }
      asset.quantityAssigned = alreadyAssigned + quantity;
      asset.quantityAvailable = Math.max(asset.quantityTotal - asset.quantityAssigned, 0);
      asset.isLowStock = asset.quantityAvailable <= (asset.minStockThreshold || 0);
      await asset.save();
    }

    // 2. Extract employee snapshots
    const employeeName = employee.name;
    const employeeCode = employee.employeeId || 'N/A';
    const departmentName = typeof employee.department === 'string' ? employee.department : (employee.department as any)?.name || 'N/A';
    const designationName = typeof (employee as any).jobPosition === 'string' ? (employee as any).jobPosition : (employee as any).jobPosition?.name || (employee as any).designation || 'N/A';
    const branchName = Array.isArray(employee.branches) && employee.branches.length > 0 ? employee.branches[0] : 'N/A';

    // 3. Create Assignment Record
    const created = await this.assignmentModel.create({
      employee: employee._id,
      employeeName,
      employeeCode,
      departmentName,
      designationName,
      branchName,
      asset: asset._id,
      size: sizeRequested,
      quantity,
      quantityReturned: 0,
      quantityPending: quantity,
      issueDate: new Date(dto.issueDate),
      issueCondition: dto.issueCondition || 'New',
      issuedBy: dto.issuedBy || 'System Admin',
      issueNotes: dto.issueNotes || '',
      status: 'active',
    });

    // Only flip the asset's single top-level status for a true one-of-a-kind
    // item. A multi-unit "individual" asset (e.g. 8 master key sets, each
    // serialized but not merged into an anonymous quantity pool) must keep
    // using the quantity fields above instead — flipping the whole asset to
    // "assigned" here would be wrong while 7 other sets are still available.
    if (isSingleUniqueAsset) {
      asset.status = 'assigned';
      await asset.save();
    }

    // 4. Create Transaction Ledger Entry
    await this.transactionService.createTransaction({
      transactionType: 'ISSUE',
      asset: asset._id as any,
      assetCode: asset.assetCode,
      assetName: asset.description || asset.assetCode,
      assetType: assetType?.name || 'Company Asset',
      size: sizeRequested,
      quantity,
      employeeName,
      employeeCode,
      departmentName,
      designationName,
      branchName,
      previousStatus: 'available',
      newStatus: 'assigned',
      condition: dto.issueCondition || 'New',
      performedBy: dto.issuedBy || 'System Admin',
      notes: dto.issueNotes || `Issued ${quantity} unit(s) to ${employeeName}`,
    });

    return this.assignmentModel.findById(created._id).populate(EMPLOYEE_POPULATE).populate(ASSET_POPULATE);
  }

  async bulkIssue(dto: BulkIssueAssetDto) {
    if (!dto.employees || dto.employees.length === 0) {
      throw new BadRequestException('At least one employee must be selected.');
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const entry of dto.employees) {
      try {
        // Per-recipient size/quantity override falls back to the batch
        // default — lets one bulk issue cover staff who need different
        // sizes (e.g. Small for one person, Large for another) instead of
        // forcing the whole batch onto a single variant.
        const assignment = await this.issue({
          ...dto,
          employee: entry.employee,
          size: entry.size || dto.size,
          quantity: entry.quantity || dto.quantity,
        });
        results.push(assignment);
      } catch (err) {
        errors.push({ employeeId: entry.employee, error: err.message || 'Failed to issue asset' });
      }
    }

    if (results.length === 0 && errors.length > 0) {
      throw new BadRequestException(errors[0].error || 'Bulk issue failed for all selected employees.');
    }

    return {
      totalRequested: dto.employees.length,
      successfulCount: results.length,
      failedCount: errors.length,
      assignments: results,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async findAll(query: Record<string, any>) {
    const { employee, asset, status, search, department, branch } = query;
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (employee) filter.employee = employee;
    if (asset) filter.asset = asset;
    if (status && status !== 'all') filter.status = status;
    if (department && department !== 'all') filter.departmentName = department;
    if (branch && branch !== 'all') filter.branchName = branch;

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { employeeName: regex },
        { employeeCode: regex },
        { departmentName: regex },
        { branchName: regex },
        { size: regex },
      ];
    }

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
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(employeeId);
    const filter: Record<string, any> = isMongoId
      ? { $or: [{ employee: employeeId }, { employeeCode: employeeId }] }
      : {
          $or: [
            { employee: employeeId },
            { employeeCode: new RegExp(`^${employeeId}$`, 'i') },
            { employeeName: new RegExp(employeeId, 'i') },
          ],
        };

    return this.assignmentModel
      .find(filter)
      .populate(EMPLOYEE_POPULATE)
      .populate(ASSET_POPULATE)
      .sort({ issueDate: -1 });
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
      throw new BadRequestException('This asset has already been fully returned.');
    }

    const currentPending = assignment.quantityPending || assignment.quantity - (assignment.quantityReturned || 0);
    const returnQty = Math.min(dto.returnQuantity || currentPending, currentPending);

    if (returnQty <= 0) {
      throw new BadRequestException('Return quantity must be greater than 0.');
    }

    const newReturned = (assignment.quantityReturned || 0) + returnQty;
    const newPending = Math.max(assignment.quantity - newReturned, 0);
    const isFullReturn = newPending === 0;

    assignment.quantityReturned = newReturned;
    assignment.quantityPending = newPending;
    assignment.status = isFullReturn ? 'returned' : 'partially_returned';
    assignment.returnDate = new Date(dto.returnDate);
    assignment.returnCondition = dto.returnCondition || 'Good';
    assignment.returnedTo = dto.returnedTo || 'System Admin';
    assignment.returnNotes = dto.returnNotes || '';
    assignment.damageOrLoss = dto.damageOrLoss || 'none';
    await assignment.save();

    // Inventory & Size Variant Updates
    const asset = await this.assetModel.findById(assignment.asset);
    if (asset) {
      const assetType = await this.assetTypeModel.findById(asset.assetType);
      const isSingleUniqueAsset =
        (assetType?.trackingType === 'individual' || (asset as any).trackingType === 'individual') && (asset.quantityTotal || 1) <= 1;

      if (isSingleUniqueAsset) {
        asset.status = dto.damageOrLoss === 'damaged' ? 'damaged' : dto.damageOrLoss === 'lost' ? 'lost' : dto.damageOrLoss === 'repair' ? 'repair' : 'available';
        await asset.save();
      } else if (asset.sizeVariants && asset.sizeVariants.length > 0 && assignment.size) {
        const variant = asset.sizeVariants.find((v) => v.size === assignment.size);
        if (variant) {
          variant.quantityAssigned = Math.max((variant.quantityAssigned || 0) - returnQty, 0);
          if (dto.damageOrLoss === 'damaged') {
            variant.quantityDamaged = (variant.quantityDamaged || 0) + returnQty;
          } else if (dto.damageOrLoss === 'lost') {
            variant.quantityLost = (variant.quantityLost || 0) + returnQty;
          } else if (dto.damageOrLoss === 'repair') {
            variant.quantityUnderRepair = (variant.quantityUnderRepair || 0) + returnQty;
          } else {
            variant.quantityAvailable = (variant.quantityAvailable || 0) + returnQty;
          }
          // Keep asset-level aggregates in sync with the variant matrix —
          // issue() updates both together; return must too, or the asset's
          // overall quantityAvailable/isLowStock stay stuck at their
          // post-issue values forever even though the variant itself is
          // correct again.
          asset.quantityAssigned = asset.sizeVariants.reduce((sum, v) => sum + (v.quantityAssigned || 0), 0);
          asset.quantityAvailable = asset.sizeVariants.reduce((sum, v) => sum + (v.quantityAvailable || 0), 0);
          asset.isLowStock = asset.quantityAvailable <= (asset.minStockThreshold || 0);
          asset.markModified('sizeVariants');
          await asset.save();
        }
      } else {
        asset.quantityAssigned = Math.max((asset.quantityAssigned || 0) - returnQty, 0);
        if (dto.damageOrLoss === 'damaged') {
          asset.quantityDamaged = (asset.quantityDamaged || 0) + returnQty;
        } else if (dto.damageOrLoss === 'lost') {
          asset.quantityLost = (asset.quantityLost || 0) + returnQty;
        } else if (dto.damageOrLoss === 'repair') {
          asset.quantityUnderRepair = (asset.quantityUnderRepair || 0) + returnQty;
        } else {
          asset.quantityAvailable = (asset.quantityAvailable || 0) + returnQty;
        }
        asset.isLowStock = asset.quantityAvailable <= (asset.minStockThreshold || 0);
        await asset.save();
      }

      // Record Audit Transaction
      const transactionType = isFullReturn ? 'RETURN' : 'PARTIAL_RETURN';
      await this.transactionService.createTransaction({
        transactionType: dto.damageOrLoss === 'damaged' ? 'DAMAGED' : dto.damageOrLoss === 'lost' ? 'LOST' : dto.damageOrLoss === 'repair' ? 'REPAIR' : transactionType,
        asset: asset._id as any,
        assetCode: asset.assetCode,
        assetName: asset.description || asset.assetCode,
        size: assignment.size || 'N/A',
        quantity: returnQty,
        employeeName: assignment.employeeName,
        employeeCode: assignment.employeeCode,
        departmentName: assignment.departmentName,
        branchName: assignment.branchName,
        previousStatus: 'assigned',
        newStatus: assignment.status,
        condition: dto.returnCondition || 'Good',
        performedBy: dto.returnedTo || 'System Admin',
        notes: dto.returnNotes || `Returned ${returnQty} unit(s) from ${assignment.employeeName}`,
      });
    }

    return this.assignmentModel.findById(id).populate(EMPLOYEE_POPULATE).populate(ASSET_POPULATE);
  }

  // Exit Clearance: pending returnable items belonging to employees who have
  // resigned or been terminated — not a general "who has equipment checked
  // out" list. An active employee holding equipment is normal and isn't an
  // exit-clearance case.
  async findPendingReturns(employeeId?: string) {
    const filter: Record<string, any> = { status: { $in: ['active', 'partially_returned'] } };
    if (employeeId) {
      filter.$or = [{ employee: employeeId }, { employeeCode: employeeId }];
    }

    const assignments = await this.assignmentModel
      .find(filter)
      .populate(EMPLOYEE_POPULATE)
      .populate(ASSET_POPULATE)
      .sort({ issueDate: 1 });

    // Exit Clearance: pending returnable items belonging to employees who have
    // resigned or been terminated — not a general "who has equipment checked
    // out" list. An active employee holding equipment is normal and isn't an
    // exit-clearance case. (This filter was dropped in a later edit to this
    // function that added the asset-level `returnable` override below —
    // restored since dropping it made every active employee's routine
    // equipment checkout show up as an "exit clearance" case again, which a
    // live test just caught.)
    return assignments.filter((a: any) => {
      const returnable = a.asset?.returnable !== false && a.asset?.assetType?.returnable !== false;
      const isLeavingEmployee = a.employee?.status === 'resigned' || a.employee?.status === 'terminated';
      return returnable && isLeavingEmployee;
    });
  }

  // Employee Asset Report Engine: Aggregates current vs historical asset assignments
  async getEmployeeAssetReport(query: Record<string, any>) {
    const { mode = 'current', employee, department, branch, assetType, size, status, search, page = 1, limit = 50 } = query;

    const filter: Record<string, any> = {};
    if (mode === 'current') {
      filter.status = { $in: ['active', 'partially_returned'] };
    } else if (status && status !== 'all') {
      filter.status = status;
    }

    if (employee) filter.$or = [{ employee }, { employeeCode: employee }];
    if (department && department !== 'all') filter.departmentName = department;
    if (branch && branch !== 'all') filter.branchName = branch;
    if (size && size !== 'all') filter.size = size;

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { employeeName: regex },
        { employeeCode: regex },
        { departmentName: regex },
        { branchName: regex },
        { size: regex },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [assignments, totalCount, summaryStats] = await Promise.all([
      this.assignmentModel
        .find(filter)
        .populate(EMPLOYEE_POPULATE)
        .populate(ASSET_POPULATE)
        .sort({ issueDate: -1 })
        .skip(skip)
        .limit(Number(limit)),
      this.assignmentModel.countDocuments(filter),
      this.getReportSummaryStats(),
    ]);

    return {
      data: assignments,
      summary: summaryStats,
      meta: {
        total: totalCount,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalCount / Number(limit)) || 1,
      },
    };
  }

  async getReportSummaryStats() {
    const [employeesWithAssetsAgg, totalAssignedAgg, exitClearancePending, partiallyReturnedAgg, damagedAgg, lostAgg] = await Promise.all([
      this.assignmentModel.distinct('employeeName', { status: { $in: ['active', 'partially_returned'] } }),
      this.assignmentModel.aggregate([
        { $match: { status: { $in: ['active', 'partially_returned'] } } },
        { $group: { _id: null, total: { $sum: '$quantityPending' } } },
      ]),
      this.findPendingReturns(),
      this.assignmentModel.aggregate([
        { $match: { status: 'partially_returned' } },
        { $group: { _id: null, total: { $sum: '$quantityPending' } } },
      ]),
      this.assignmentModel.countDocuments({ damageOrLoss: 'damaged' }),
      this.assignmentModel.countDocuments({ damageOrLoss: 'lost' }),
    ]);

    const exitClearanceTotal = exitClearancePending.reduce((sum: number, a: any) => sum + (a.quantityPending || a.quantity || 0), 0);
    const partiallyReturnedTotal = partiallyReturnedAgg[0]?.total || 0;
    const pendingReturns = exitClearanceTotal + partiallyReturnedTotal;

    return {
      employeesWithAssets: employeesWithAssetsAgg.length,
      totalAssignedItems: totalAssignedAgg[0]?.total || 0,
      pendingReturns,
      damagedAssets: damagedAgg,
      lostAssets: lostAgg,
    };
  }

  async getDashboardStats() {
    const [statusAgg, categoryAgg, totalAssets, lowStockCount] = await Promise.all([
      this.assetModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.assetModel.aggregate([
        { $lookup: { from: 'assettypes', localField: 'assetType', foreignField: '_id', as: 'type' } },
        { $unwind: '$type' },
        { $group: { _id: '$type.category', count: { $sum: 1 } } },
        { $project: { category: '$_id', count: 1, _id: 0 } },
      ]),
      this.assetModel.countDocuments(),
      this.assetModel.countDocuments({ isLowStock: true }),
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
      lowStockCount,
      categoryDistribution: categoryAgg,
    };
  }

  async getAlerts() {
    const [pendingReturns, damagedAssets, activeAssignments, lowStockAssets] = await Promise.all([
      this.findPendingReturns(),
      this.assetModel.find({ status: { $in: ['damaged', 'lost'] } }).populate('assetType', 'name category'),
      this.assignmentModel.find({ status: 'active' }).populate('employee', 'name').populate(ASSET_POPULATE),
      this.assetModel.find({ isLowStock: true }).populate('assetType', 'name category'),
    ]);

    return { pendingReturns, damagedAssets, replacementDue: [], lowStockAssets };
  }
}
