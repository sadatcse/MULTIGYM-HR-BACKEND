import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { MaintenanceRequest } from './maintenance-request.schema';
import { Employee } from '../../user/schemas/employee.schema';

export type MaintenanceWorkUpdateDocument = MaintenanceWorkUpdate & Document;

@Schema({ timestamps: true, collection: 'maintenance_work_updates' })
export class MaintenanceWorkUpdate {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'MaintenanceRequest', required: true, index: true })
  maintenanceRequest: MaintenanceRequest;

  @Prop({ trim: true, required: true })
  update: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true })
  updatedBy: Employee;

  @Prop({ type: [String], default: [] })
  photos: string[];
}

export const MaintenanceWorkUpdateSchema = SchemaFactory.createForClass(MaintenanceWorkUpdate);

MaintenanceWorkUpdateSchema.index({ maintenanceRequest: 1, createdAt: -1 });
