import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AssetDocument = HydratedDocument<Asset>;

@Schema({ timestamps: true })
export class Asset {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AssetType', required: true, index: true })
  assetType: Types.ObjectId;

  @Prop({ required: [true, 'Asset code is required'], trim: true, unique: true })
  assetCode: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  size?: string;

  @Prop({ trim: true })
  serialNumber?: string;

  // For inventory-tracked types: total stock of this SKU. Always 1 for individual/serialized items.
  @Prop({ default: 1, min: 1 })
  quantityTotal: number;

  @Prop()
  purchaseDate?: Date;

  @Prop({ trim: true })
  condition?: string;

  @Prop({ enum: ['available', 'assigned', 'damaged', 'lost', 'repair', 'disposed'], default: 'available' })
  status: string;

  @Prop({ trim: true, default: '' })
  notes: string;
}

export const AssetSchema = SchemaFactory.createForClass(Asset);
AssetSchema.index({ assetCode: 1 }, { unique: true });
AssetSchema.index({ assetType: 1 });
AssetSchema.index({ status: 1 });
