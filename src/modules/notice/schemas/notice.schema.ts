import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Employee } from '../../user/schemas/employee.schema';

export type NoticeDocument = Notice & Document;

export enum NoticeCategory {
  GENERAL = 'General',
  HR = 'HR',
  POLICY = 'Policy',
  ATTENDANCE = 'Attendance',
  PAYROLL = 'Payroll',
  COMPLIANCE = 'Compliance',
  TRAINING = 'Training',
  EMERGENCY = 'Emergency',
  MANAGEMENT_INSTRUCTION = 'Management Instruction',
  IMPORTANT_ANNOUNCEMENT = 'Important Announcement',
}

export enum NoticePriority {
  NORMAL = 'Normal',
  IMPORTANT = 'Important',
  URGENT = 'Urgent',
  CRITICAL = 'Critical',
}

export enum NoticeStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum TargetType {
  ALL = 'all',
  DEPARTMENT = 'department',
  DESIGNATION = 'designation',
  BRANCH = 'branch',
  EMPLOYEES = 'employees',
}

@Schema({ _id: false })
export class NoticeAttachment {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  url: string;

  @Prop()
  fileType?: string;

  @Prop()
  size?: number;
}

export const NoticeAttachmentSchema = SchemaFactory.createForClass(NoticeAttachment);

@Schema({ timestamps: true, collection: 'notices' })
export class Notice {
  @Prop({ required: [true, 'Notice title is required'], trim: true })
  title: string;

  @Prop({ required: [true, 'Notice content is required'] })
  content: string;

  @Prop({
    type: String,
    enum: Object.values(NoticeCategory),
    default: NoticeCategory.GENERAL,
  })
  category: NoticeCategory;

  @Prop({
    type: String,
    enum: Object.values(NoticePriority),
    default: NoticePriority.NORMAL,
  })
  priority: NoticePriority;

  @Prop({
    type: String,
    enum: Object.values(NoticeStatus),
    default: NoticeStatus.DRAFT,
  })
  status: NoticeStatus;

  @Prop({ type: [NoticeAttachmentSchema], default: [] })
  attachments: NoticeAttachment[];

  @Prop({
    type: String,
    enum: Object.values(TargetType),
    default: TargetType.ALL,
  })
  targetType: TargetType;

  @Prop({ type: [String], default: [] })
  targetDepartments: string[];

  @Prop({ type: [String], default: [] })
  targetDesignations: string[];

  @Prop({ type: [String], default: [] })
  targetBranches: string[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Employee' }], default: [] })
  targetEmployees: Employee[];

  @Prop({ type: Boolean, default: true })
  requiresAcknowledgement: boolean;

  @Prop({ type: Date })
  acknowledgementDeadline?: Date;

  @Prop({ type: Boolean, default: true })
  allowDownload: boolean;

  @Prop({ type: Boolean, default: true })
  sendNotification: boolean;

  @Prop({ type: Number, default: 1 })
  version: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true })
  createdBy: Employee;

  @Prop({ type: Date })
  publishedAt?: Date;

  @Prop({ type: Date })
  expiresAt?: Date;
}

export const NoticeSchema = SchemaFactory.createForClass(Notice);
