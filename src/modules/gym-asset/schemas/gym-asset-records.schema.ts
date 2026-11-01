import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  ACTOR_SHAPE,
  ActorRef,
  ASSET_CONDITIONS,
  DISPOSAL_TYPES,
  FILE_SHAPE,
  FileRef,
  HISTORY_EVENTS,
  MAINTENANCE_STATUSES,
  MAINTENANCE_TYPES,
  NamedRef,
  REF_SHAPE,
} from './gym-asset-common';

// Transfer, maintenance, disposal and history records. Each keeps a snapshot
// of the asset (code, name, place) as it was, so old records still read right
// after the asset is renamed, moved or disposed.

// Snapshot-locked records refuse bulk rewrites and deletes at the model level.
function appendOnly(schema: MongooseSchema, label: string) {
  const refuse = (next: (err?: Error) => void) => next(new Error(`${label} records can't be changed or deleted`));
  for (const op of ['deleteOne', 'deleteMany', 'findOneAndDelete', 'replaceOne', 'findOneAndReplace'] as const) {
    schema.pre(op, function (next: any) {
      refuse(next);
    });
  }
}

// ---------------------------------------------------------------- transfer
export type GymAssetTransferDocument = HydratedDocument<GymAssetTransfer>;

@Schema({ timestamps: true, collection: 'gym_asset_transfers' })
export class GymAssetTransfer {
  @Prop({ required: true, unique: true })
  transferId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'GymAsset', required: true, index: true })
  asset: Types.ObjectId;

  // When only part of a batch moved, the new register line created at the destination.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'GymAsset', default: null, index: true })
  movedAsset?: Types.ObjectId | null;

  @Prop({ required: true })
  assetCode: string;

  @Prop({ required: true })
  assetName: string;

  @Prop({ default: '' })
  categoryName: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ default: 'pcs' })
  unit: string;

  @Prop({ type: REF_SHAPE, required: true })
  fromLocation: NamedRef;

  @Prop({ type: REF_SHAPE, required: true })
  fromPlace: NamedRef;

  @Prop({ type: REF_SHAPE, required: true })
  toLocation: NamedRef;

  @Prop({ type: REF_SHAPE, required: true })
  toPlace: NamedRef;

  @Prop({ required: true, index: true })
  transferDate: Date;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ trim: true, default: '' })
  note: string;

  @Prop({ type: String })
  requestId?: string;

  @Prop({ type: ACTOR_SHAPE, default: () => ({}) })
  by: ActorRef;
}
export const GymAssetTransferSchema = SchemaFactory.createForClass(GymAssetTransfer);
GymAssetTransferSchema.index({ requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } });
GymAssetTransferSchema.index({ 'toLocation.id': 1, transferDate: -1 });
GymAssetTransferSchema.index({ 'fromLocation.id': 1, transferDate: -1 });
appendOnly(GymAssetTransferSchema, 'Transfer');

// ---------------------------------------------------------------- maintenance
export type GymAssetMaintenanceDocument = HydratedDocument<GymAssetMaintenance>;

@Schema({ timestamps: true, collection: 'gym_asset_maintenance' })
export class GymAssetMaintenance {
  @Prop({ required: true, unique: true })
  maintenanceId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'GymAsset', required: true, index: true })
  asset: Types.ObjectId;

  @Prop({ required: true })
  assetCode: string;

  @Prop({ required: true })
  assetName: string;

  @Prop({ type: REF_SHAPE, required: true })
  location: NamedRef;

  @Prop({ type: REF_SHAPE, required: true })
  place: NamedRef;

  @Prop({ required: [true, 'Describe the problem'], trim: true })
  problem: string;

  @Prop({ enum: MAINTENANCE_TYPES, default: 'repair' })
  maintenanceType: string;

  @Prop({ trim: true, default: '' })
  serviceProvider: string;

  @Prop({ trim: true, default: '' })
  technician: string;

  @Prop({ required: true, index: true })
  maintenanceDate: Date;

  @Prop()
  completionDate?: Date;

  @Prop({ default: 0, min: 0 })
  cost: number;

  @Prop({ index: true })
  nextMaintenanceDate?: Date;

  @Prop({ enum: MAINTENANCE_STATUSES, default: 'pending', index: true })
  status: string;

  @Prop({ type: FILE_SHAPE, default: [] })
  attachments: FileRef[];

  @Prop({ trim: true, default: '' })
  remarks: string;

  // Condition before the work (restored if cancelled) and after it finished.
  @Prop({ enum: ASSET_CONDITIONS })
  conditionBefore: string;

  @Prop({ enum: ASSET_CONDITIONS })
  conditionAfter?: string;

  @Prop({ type: String })
  requestId?: string;

  @Prop({ type: ACTOR_SHAPE, default: () => ({}) })
  by: ActorRef;
}
export const GymAssetMaintenanceSchema = SchemaFactory.createForClass(GymAssetMaintenance);
GymAssetMaintenanceSchema.index({ requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } });
appendOnly(GymAssetMaintenanceSchema, 'Maintenance');

// ---------------------------------------------------------------- disposal
export type GymAssetDisposalDocument = HydratedDocument<GymAssetDisposal>;

@Schema({ timestamps: true, collection: 'gym_asset_disposals' })
export class GymAssetDisposal {
  @Prop({ required: true, unique: true })
  disposalId: string;

  // One disposal per asset.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'GymAsset', required: true, unique: true })
  asset: Types.ObjectId;

  @Prop({ required: true })
  assetCode: string;

  @Prop({ required: true })
  assetName: string;

  @Prop({ default: '' })
  categoryName: string;

  @Prop({ default: 1 })
  quantity: number;

  @Prop({ type: REF_SHAPE, required: true })
  location: NamedRef;

  @Prop({ type: REF_SHAPE, required: true })
  place: NamedRef;

  // Purchase value of the line when it was disposed (unit price × quantity).
  @Prop({ default: 0 })
  bookValue: number;

  @Prop({ required: true, index: true })
  disposalDate: Date;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ enum: DISPOSAL_TYPES, required: true, index: true })
  disposalType: string;

  // Money received (sold) or recovered; 0 for lost / scrapped.
  @Prop({ default: 0, min: 0 })
  disposalValue: number;

  @Prop({ type: ACTOR_SHAPE, required: true })
  approvedBy: ActorRef;

  @Prop({ type: FILE_SHAPE, default: [] })
  attachments: FileRef[];

  @Prop({ trim: true, default: '' })
  remarks: string;

  @Prop({ type: String })
  requestId?: string;

  @Prop({ type: ACTOR_SHAPE, default: () => ({}) })
  by: ActorRef;
}
export const GymAssetDisposalSchema = SchemaFactory.createForClass(GymAssetDisposal);
GymAssetDisposalSchema.index({ requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } });
appendOnly(GymAssetDisposalSchema, 'Disposal');

// ---------------------------------------------------------------- history
export type GymAssetHistoryDocument = HydratedDocument<GymAssetHistory>;

// Append-only audit trail for one asset. Nothing exposes an edit or delete
// route, and the model itself refuses updates and deletes.
@Schema({ timestamps: { createdAt: 'at', updatedAt: false }, collection: 'gym_asset_history' })
export class GymAssetHistory {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'GymAsset', required: true, index: true })
  asset: Types.ObjectId;

  @Prop({ required: true })
  assetCode: string;

  @Prop({ enum: HISTORY_EVENTS, required: true })
  event: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: [{ field: String, from: String, to: String }], default: [] })
  changes: Array<{ field: string; from: string; to: string }>;

  // Transfer / maintenance / disposal number this entry belongs to.
  @Prop({ default: '' })
  ref: string;

  @Prop({ type: ACTOR_SHAPE, default: () => ({}) })
  by: ActorRef;

  at: Date;
}
export const GymAssetHistorySchema = SchemaFactory.createForClass(GymAssetHistory);
GymAssetHistorySchema.index({ asset: 1, at: -1 });
appendOnly(GymAssetHistorySchema, 'History');
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate'] as const) {
  GymAssetHistorySchema.pre(op, function (next: any) {
    next(new Error("History records can't be changed or deleted"));
  });
}

// ---------------------------------------------------------------- counters
export type GymAssetCounterDocument = HydratedDocument<GymAssetCounter>;

// Sequence per prefix (AST, TRF, MNT, DSP) for human-readable IDs.
@Schema({ collection: 'gym_asset_counters' })
export class GymAssetCounter {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ default: 0 })
  seq: number;
}
export const GymAssetCounterSchema = SchemaFactory.createForClass(GymAssetCounter);
