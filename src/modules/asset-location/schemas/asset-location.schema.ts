import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AssetLocationDocument = HydratedDocument<AssetLocation>;

// A place where asset stock is kept (store room, cupboard, reception desk).
// Assets point at one of these so anyone can find where an item is stored.
@Schema({ timestamps: true })
export class AssetLocation {
  @Prop({ required: [true, 'Location name is required'], trim: true })
  name: string;

  // Branch name as stored on employees; empty for a central store not tied to one branch.
  @Prop({ trim: true, default: '' })
  branch: string;

  // Where exactly: floor, room, landmark.
  @Prop({ trim: true, default: '' })
  details: string;

  // Person who holds the keys and answers for the stock kept here.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', default: null })
  inCharge?: Types.ObjectId | null;

  @Prop({ enum: ['active', 'inactive'], default: 'active' })
  status: string;
}

export const AssetLocationSchema = SchemaFactory.createForClass(AssetLocation);
AssetLocationSchema.index({ name: 1, branch: 1 }, { unique: true });
