import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HrLetterCounterDocument = HydratedDocument<HrLetterCounter>;

// One row per memo prefix + year ("MGP/HR/APT/2026"). Incremented with an
// atomic $inc so two letters issued at the same moment never share a number.
@Schema({ collection: 'hr_letter_counters' })
export class HrLetterCounter {
  @Prop({ required: true, unique: true, trim: true })
  key: string;

  @Prop({ required: true, default: 0, type: Number })
  seq: number;
}

export const HrLetterCounterSchema = SchemaFactory.createForClass(HrLetterCounter);
