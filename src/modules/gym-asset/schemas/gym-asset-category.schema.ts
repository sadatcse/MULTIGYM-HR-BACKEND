import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GymAssetCategoryDocument = HydratedDocument<GymAssetCategory>;

@Schema({ timestamps: true, collection: 'gym_asset_categories' })
export class GymAssetCategory {
  @Prop({ required: [true, 'Category name is required'], trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  description: string;

  // Straight-line depreciation, % of the purchase price per year. Drives the
  // "current value" in reports; 0 keeps the purchase price.
  @Prop({ default: 0, min: 0, max: 100 })
  depreciationRate: number;

  @Prop({ enum: ['active', 'inactive'], default: 'active' })
  status: string;
}

export const GymAssetCategorySchema = SchemaFactory.createForClass(GymAssetCategory);
GymAssetCategorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
