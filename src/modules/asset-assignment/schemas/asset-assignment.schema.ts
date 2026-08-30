import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AssetAssignmentDocument = HydratedDocument<AssetAssignment>;

// This collection is both the assignment record AND the permanent audit
// trail: an issue creates a record, a return updates that same record in
// place — nothing is ever deleted, so a full history survives per asset
// and per employee.
@Schema({ timestamps: true })
export class AssetAssignment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true, index: true })
  employee: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Asset', required: true, index: true })
  asset: Types.ObjectId;

  @Prop({ default: 1, min: 1 })
  quantity: number;

  @Prop({ required: [true, 'Issue date is required'] })
  issueDate: Date;

  @Prop({ trim: true })
  issueCondition?: string;

  @Prop({ trim: true })
  issuedBy?: string;

  @Prop({ trim: true })
  issueNotes?: string;

  @Prop({ enum: ['active', 'returned'], default: 'active' })
  status: string;

  @Prop()
  returnDate?: Date;

  @Prop({ trim: true })
  returnCondition?: string;

  @Prop({ trim: true })
  returnedTo?: string;

  @Prop({ trim: true })
  returnNotes?: string;

  @Prop({ enum: ['none', 'damaged', 'lost'], default: 'none' })
  damageOrLoss: string;
}

export const AssetAssignmentSchema = SchemaFactory.createForClass(AssetAssignment);
AssetAssignmentSchema.index({ employee: 1, status: 1 });
AssetAssignmentSchema.index({ asset: 1, status: 1 });
