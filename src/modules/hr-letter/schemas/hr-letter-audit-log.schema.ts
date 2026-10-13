import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type HrLetterAuditLogDocument = HydratedDocument<HrLetterAuditLog>;

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'hr_letter_audit_logs' })
export class HrLetterAuditLog {
  @Prop({ type: Types.ObjectId, ref: 'EmployeeHrLetter', default: null, index: true })
  letterId?: Types.ObjectId;

  @Prop({ trim: true, index: true })
  letterNumber?: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee', default: null, index: true })
  employeeId?: Types.ObjectId;

  @Prop({ trim: true })
  employeeName?: string;

  @Prop({
    required: true,
    enum: [
      'created',
      'edited',
      'generated',
      'downloaded',
      'printed',
      'regenerated',
      'deleted',
      'reissued',
      'viewed',
    ],
    index: true,
  })
  action: string;

  @Prop({
    type: {
      id: { type: Types.ObjectId, ref: 'User' },
      name: String,
      role: String,
    },
    required: true,
  })
  performedBy: {
    id: Types.ObjectId;
    name: string;
    role: string;
  };

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  metadata?: Record<string, any>;

  @Prop({ trim: true })
  ipAddress?: string;

  @Prop({ trim: true })
  userAgent?: string;
}

export const HrLetterAuditLogSchema = SchemaFactory.createForClass(HrLetterAuditLog);
HrLetterAuditLogSchema.index({ letterId: 1, createdAt: -1 });
HrLetterAuditLogSchema.index({ employeeId: 1, createdAt: -1 });
HrLetterAuditLogSchema.index({ action: 1, createdAt: -1 });
