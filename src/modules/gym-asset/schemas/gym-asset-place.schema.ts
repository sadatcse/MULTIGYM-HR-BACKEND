import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type GymAssetPlaceDocument = HydratedDocument<GymAssetPlace>;

// An area inside a location: "Main Gym Floor", "Store Room", "Parking Area".
@Schema({ timestamps: true, collection: 'gym_asset_places' })
export class GymAssetPlace {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'GymAssetLocation', required: true, index: true })
  location: Types.ObjectId;

  @Prop({ required: [true, 'Place name is required'], trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ enum: ['active', 'inactive'], default: 'active' })
  status: string;
}

export const GymAssetPlaceSchema = SchemaFactory.createForClass(GymAssetPlace);
GymAssetPlaceSchema.index({ location: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
