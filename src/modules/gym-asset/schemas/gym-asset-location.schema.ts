import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GymAssetLocationDocument = HydratedDocument<GymAssetLocation>;

// A site that holds gym assets: a gym branch, the warehouse, head office.
// Independent of the HR branches and the uniform stock locations.
@Schema({ timestamps: true, collection: 'gym_asset_locations' })
export class GymAssetLocation {
  @Prop({ required: [true, 'Location name is required'], trim: true })
  name: string;

  @Prop({ enum: ['branch', 'warehouse', 'head_office', 'other'], default: 'branch' })
  type: string;

  @Prop({ trim: true, default: '' })
  address: string;

  @Prop({ trim: true, default: '' })
  contactPerson: string;

  @Prop({ trim: true, default: '' })
  contactNumber: string;

  @Prop({ enum: ['active', 'inactive'], default: 'active' })
  status: string;
}

export const GymAssetLocationSchema = SchemaFactory.createForClass(GymAssetLocation);
GymAssetLocationSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
