import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TransactionLogDocument = HydratedDocument<TransactionLog>;

@Schema({ timestamps: true })
export class TransactionLog {
  @Prop({ required: [true, 'Transaction type is required'], trim: true, uppercase: true })
  transactionType: string;

  @Prop({ required: true, trim: true })
  transactionCode: string;

  @Prop({ required: true, trim: true, lowercase: true })
  userEmail: string;

  @Prop({ required: true, trim: true })
  userName: string;

  // The middleware sets/filters on `branch`, but the original schema never declared
  // it, so Mongoose's strict mode silently dropped it before every save.
  @Prop({ trim: true })
  branch?: string;

  @Prop({ enum: ['success', 'failed', 'pending'], required: true, default: 'pending' })
  status: string;

  @Prop({ required: true, trim: true })
  ipAddress: string;

  @Prop({ trim: true })
  details?: string;

  @Prop({ default: null, trim: true })
  Message?: string;

  @Prop({ default: null })
  stackTrace?: string;

  @Prop({ default: Date.now })
  transactionTime: Date;
}

export const TransactionLogSchema = SchemaFactory.createForClass(TransactionLog);

// Support the common log-viewer access patterns: latest-first feeds, per-branch feeds, per-user history, status filters
TransactionLogSchema.index({ transactionTime: -1 });
TransactionLogSchema.index({ branch: 1, transactionTime: -1 });
TransactionLogSchema.index({ userEmail: 1, transactionTime: -1 });
TransactionLogSchema.index({ status: 1 });
