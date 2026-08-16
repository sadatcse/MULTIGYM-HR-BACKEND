import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

export type GymWeeklyDefaultDocument = GymWeeklyDefault & Document;

@Schema({ timestamps: true })
export class GymWeeklyDefault {
  @Prop({ required: true, trim: true, default: 'global' })
  branchId: string; // 'global' or specific branch _id

  @Prop({
    type: SchemaTypes.Mixed,
    default: {
      saturday: { gymStatus: 'open', dayType: 'working_day', openingTime: '07:00', closingTime: '23:00' },
      sunday: { gymStatus: 'open', dayType: 'working_day', openingTime: '07:00', closingTime: '23:00' },
      monday: { gymStatus: 'open', dayType: 'working_day', openingTime: '07:00', closingTime: '23:00' },
      tuesday: { gymStatus: 'open', dayType: 'working_day', openingTime: '07:00', closingTime: '23:00' },
      wednesday: { gymStatus: 'open', dayType: 'working_day', openingTime: '07:00', closingTime: '23:00' },
      thursday: { gymStatus: 'open', dayType: 'working_day', openingTime: '07:00', closingTime: '23:00' },
      friday: { gymStatus: 'closed', dayType: 'weekly_off', openingTime: '', closingTime: '' },
    },
  })
  schedule: any;
}

export const GymWeeklyDefaultSchema = SchemaFactory.createForClass(GymWeeklyDefault);
