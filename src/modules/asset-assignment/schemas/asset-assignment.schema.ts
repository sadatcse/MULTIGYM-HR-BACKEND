import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AssetAssignmentDocument = HydratedDocument<AssetAssignment>;

// This collection is both the assignment record AND the permanent audit
// trail: an issue creates a record, a return updates that same record in
// place — nothing is ever deleted, so a full history survives per asset
// and per employee.
@Schema({ timestamps: true })
export class AssetAssignment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: false, index: true })
  employee?: Types.ObjectId;

  // Immutable historical employee snapshot fields (Survives employee deletion)
  @Prop({ required: [true, 'Employee name snapshot is required'], trim: true, index: true })
  employeeName: string;

  @Prop({ trim: true, index: true })
  employeeCode?: string;

  @Prop({ trim: true })
  departmentName?: string;

  @Prop({ trim: true })
  designationName?: string;

  @Prop({ trim: true })
  branchName?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Asset', required: true, index: true })
  asset: Types.ObjectId;

  @Prop({ trim: true })
  size?: string;

  @Prop({ default: 1, min: 1 })
  quantity: number;

  @Prop({ default: 0, min: 0 })
  quantityReturned: number;

  @Prop({ default: 1, min: 0 })
  quantityPending: number;

  @Prop({ required: [true, 'Issue date is required'] })
  issueDate: Date;

  @Prop({ trim: true })
  issueCondition?: string;

  @Prop({ trim: true })
  issuedBy?: string;

  @Prop({ trim: true })
  issueNotes?: string;

  @Prop({ enum: ['active', 'returned', 'partially_returned', 'transferred', 'damaged', 'lost', 'repair'], default: 'active' })
  status: string;

  @Prop()
  returnDate?: Date;

  @Prop({ trim: true })
  returnCondition?: string;

  @Prop({ trim: true })
  returnedTo?: string;

  @Prop({ trim: true })
  returnNotes?: string;

  @Prop({ enum: ['none', 'damaged', 'lost', 'repair'], default: 'none' })
  damageOrLoss: string;
}

export const AssetAssignmentSchema = SchemaFactory.createForClass(AssetAssignment);
AssetAssignmentSchema.index({ employee: 1, status: 1 });
AssetAssignmentSchema.index({ asset: 1, status: 1 });
