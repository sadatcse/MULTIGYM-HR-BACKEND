import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AssetDocument = HydratedDocument<Asset>;

@Schema({ timestamps: true })
export class Asset {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AssetType', required: true, index: true })
  assetType: Types.ObjectId;

  @Prop({ required: [true, 'Asset code is required'], trim: true, unique: true })
  assetCode: string;

  // Product Type: 'simple' (Single Item/SKU) vs 'variable' (Multi-variant size/color matrix)
  @Prop({ required: true, enum: ['simple', 'variable'], default: 'simple' })
  productType: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: true })
  returnable: boolean;

  @Prop({ trim: true })
  size?: string;

  @Prop({ trim: true })
  serialNumber?: string;

  // For inventory-tracked types: total stock of this SKU. Always 1 for individual/serialized items.
  @Prop({ default: 1, min: 0 })
  quantityTotal: number;

  @Prop({ default: 1, min: 0 })
  quantityAvailable: number;

  @Prop({ default: 0, min: 0 })
  quantityAssigned: number;

  @Prop({ default: 0, min: 0 })
  quantityDamaged: number;

  @Prop({ default: 0, min: 0 })
  quantityLost: number;

  @Prop({ default: 0, min: 0 })
  quantityUnderRepair: number;

  @Prop({ default: 0, min: 0 })
  minStockThreshold: number;

  @Prop({ default: false })
  isLowStock: boolean;

  // Dynamic Key-Value Attributes (e.g. Color: Red, Size: XXL, Storage: 512GB)
  @Prop({
    type: [
      {
        name: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
    default: [],
  })
  attributes: Array<{
    name: string;
    value: string;
  }>;

  // Size / Attribute Variant Breakdown (e.g. XXL - Red, XL - Black)
  @Prop({
    type: [
      {
        size: { type: String, required: true },
        variantName: { type: String },
        quantityTotal: { type: Number, default: 0, min: 0 },
        quantityAvailable: { type: Number, default: 0, min: 0 },
        quantityAssigned: { type: Number, default: 0, min: 0 },
        quantityDamaged: { type: Number, default: 0, min: 0 },
        quantityLost: { type: Number, default: 0, min: 0 },
        quantityUnderRepair: { type: Number, default: 0, min: 0 },
        minStockThreshold: { type: Number, default: 0, min: 0 },
      },
    ],
    default: [],
  })
  sizeVariants: Array<{
    size: string;
    variantName?: string;
    quantityTotal: number;
    quantityAvailable: number;
    quantityAssigned: number;
    quantityDamaged: number;
    quantityLost: number;
    quantityUnderRepair: number;
    minStockThreshold: number;
  }>;

  @Prop()
  purchaseDate?: Date;

  @Prop({ trim: true })
  condition?: string;

  @Prop({ enum: ['available', 'assigned', 'damaged', 'lost', 'repair', 'disposed', 'low_stock'], default: 'available' })
  status: string;

  @Prop({ trim: true, default: '' })
  notes: string;
}

export const AssetSchema = SchemaFactory.createForClass(Asset);
AssetSchema.index({ assetCode: 1 }, { unique: true });
AssetSchema.index({ assetType: 1 });
AssetSchema.index({ status: 1 });
