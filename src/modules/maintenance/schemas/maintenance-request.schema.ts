import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Employee } from '../../user/schemas/employee.schema';
import { Vendor } from '../../vendor/schemas/vendor.schema';

export type MaintenanceRequestDocument = MaintenanceRequest & Document;

export enum MaintenanceCategory {
  AC = 'AC',
  ELECTRICAL = 'Electrical',
  PLUMBING = 'Plumbing',
  EQUIPMENT = 'Equipment',
  CCTV = 'CCTV',
  ACCESS_CONTROL = 'Access Control',
  INTERIOR = 'Interior',
  INTERNET = 'Internet',
  GENERAL = 'General Maintenance',
}

export enum MaintenancePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum MaintenanceStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum MaintenanceAssigneeType {
  EMPLOYEE = 'employee',
  VENDOR = 'vendor',
}

@Schema({ timestamps: true, collection: 'maintenance_requests' })
export class MaintenanceRequest {
  @Prop({ trim: true, default: 'All Branches' })
  branch: string;

  @Prop({
    type: String,
    enum: Object.values(MaintenanceCategory),
    required: [true, 'Category is required'],
  })
  category: MaintenanceCategory;

  @Prop({ required: [true, 'Issue / problem is required'], trim: true })
  issue: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: String,
    enum: Object.values(MaintenancePriority),
    default: MaintenancePriority.MEDIUM,
  })
  priority: MaintenancePriority;

  @Prop({
    type: String,
    enum: Object.values(MaintenanceStatus),
    default: MaintenanceStatus.OPEN,
  })
  status: MaintenanceStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true })
  reportedBy: Employee;

  @Prop({ type: Date, default: Date.now })
  reportedDate: Date;

  @Prop({ type: String, enum: Object.values(MaintenanceAssigneeType) })
  assignedToType?: MaintenanceAssigneeType;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee' })
  assignedToEmployee?: Employee;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vendor' })
  assignedToVendor?: Vendor;

  @Prop({ type: Number, min: 0 })
  estimatedCost?: number;

  @Prop({ type: Number, min: 0 })
  actualCost?: number;

  @Prop({ type: Date })
  deadline?: Date;

  @Prop({ type: Date })
  completedDate?: Date;

  @Prop({ type: [String], default: [] })
  beforePhotos: string[];

  @Prop({ type: [String], default: [] })
  afterPhotos: string[];

  // Denormalized copy of the latest work-update comment, so list views can
  // show it without a second query — the full history lives in
  // MaintenanceWorkUpdate (same idiom as Task's latestRemark/TaskUpdate).
  @Prop({ trim: true })
  latestWorkUpdate?: string;

  @Prop({ trim: true })
  rejectionReason?: string;

  @Prop({ trim: true })
  cancellationReason?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true })
  createdBy: Employee;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee' })
  updatedBy?: Employee;
}

export const MaintenanceRequestSchema = SchemaFactory.createForClass(MaintenanceRequest);

MaintenanceRequestSchema.index({ status: 1 });
MaintenanceRequestSchema.index({ branch: 1 });
MaintenanceRequestSchema.index({ category: 1 });
MaintenanceRequestSchema.index({ priority: 1 });
MaintenanceRequestSchema.index({ reportedBy: 1 });
MaintenanceRequestSchema.index({ deadline: 1 });
MaintenanceRequestSchema.index({ createdAt: -1 });
