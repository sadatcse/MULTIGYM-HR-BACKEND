import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { ACTOR_SHAPE, ActorRef, ASSET_CONDITIONS, ASSET_STATUSES, FILE_SHAPE, FileRef } from './gym-asset-common';

export type GymAssetDocument = HydratedDocument<GymAsset>;

// One line in the asset register: a single item (a treadmill) or a batch of
// identical items (20 dumbbells, unit "pcs").
@Schema({ timestamps: true, collection: 'gym_assets' })
export class GymAsset {
  @Prop({ required: true, unique: true, trim: true })
  assetCode: string;

  @Prop({ required: [true, 'Asset name is required'], trim: true })
  name: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'GymAssetCategory', required: true, index: true })
  category: Types.ObjectId;

  @Prop({ type: FILE_SHAPE, default: [] })
  images: FileRef[];

  @Prop({ trim: true, default: '' })
  brand: string;

  @Prop({ trim: true, default: '' })
  modelNumber: string;

  @Prop({ trim: true, default: '' })
  serialNumber: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ trim: true, default: '' })
  specification: string;

  @Prop({ required: true, min: 1, default: 1 })
  quantity: number;

  @Prop({ trim: true, default: 'pcs' })
  unit: string;

  @Prop()
  purchaseDate?: Date;

  // Price of ONE unit; the line's value is unitPrice × quantity.
  @Prop({ default: 0, min: 0 })
  unitPrice: number;

  @Prop({ trim: true, default: '' })
  supplier: string;

  // Warranty length as bought, e.g. 24 months; warrantyExpiry is what reports use.
  @Prop({ default: 0, min: 0 })
  warrantyMonths: number;

  @Prop({ index: true })
  warrantyExpiry?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'GymAssetLocation', required: true, index: true })
  location: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'GymAssetPlace', required: true, index: true })
  place: Types.ObjectId;

  // Name of the person responsible for the item (optional); the reports' person filter.
  @Prop({ trim: true, default: '', index: true })
  responsiblePerson: string;

  @Prop({ enum: ASSET_CONDITIONS, default: 'new', index: true })
  condition: string;

  @Prop({ enum: ASSET_STATUSES, default: 'active', index: true })
  status: string;

  // Set when the line was created by moving part of a batch to another place.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'GymAsset', default: null })
  splitFrom?: Types.ObjectId | null;

  @Prop({ trim: true, default: '' })
  notes: string;

  // Client-generated key so a retried "save" on a slow connection can't create a duplicate.
  @Prop({ type: String })
  requestId?: string;

  @Prop({ type: ACTOR_SHAPE, default: () => ({}) })
  createdBy: ActorRef;

  @Prop({ type: ACTOR_SHAPE, default: () => ({}) })
  updatedBy: ActorRef;
}

export const GymAssetSchema = SchemaFactory.createForClass(GymAsset);
GymAssetSchema.index({ requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } });
GymAssetSchema.index({ status: 1, location: 1, place: 1 });
GymAssetSchema.index({ status: 1, createdAt: -1 });
