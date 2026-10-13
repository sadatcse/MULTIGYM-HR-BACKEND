import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { HR_LETTER_TYPES } from './hr-letter-template.schema';

export type EmployeeHrLetterDocument = HydratedDocument<EmployeeHrLetter>;

@Schema({ timestamps: true, collection: 'employee_hr_letters' })
export class EmployeeHrLetter {
  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true, index: true })
  employeeId: Types.ObjectId;

  @Prop({ trim: true, index: true })
  employeeCode?: string;

  @Prop({ required: true, trim: true })
  employeeName: string;

  @Prop({ trim: true })
  employeePhoto?: string;

  @Prop({
    required: true,
    enum: HR_LETTER_TYPES,
    index: true,
  })
  letterType: string;

  @Prop({
    required: true,
    unique: true,
    trim: true,
    index: true,
  })
  letterNumber: string;

  @Prop({ required: true, trim: true })
  letterDate: string;

  @Prop({ trim: true })
  effectiveDate?: string;

  @Prop({ type: Types.ObjectId, ref: 'HrLetterTemplate', default: null })
  templateId?: Types.ObjectId;

  @Prop({ trim: true })
  branch?: string;

  @Prop({ trim: true })
  department?: string;

  @Prop({ trim: true })
  designation?: string;

  @Prop({
    required: true,
    enum: ['draft', 'generated', 'issued', 'reissued', 'cancelled'],
    default: 'generated',
    index: true,
  })
  status: string;

  @Prop({ default: 1, type: Number })
  version: number;

  @Prop({ type: Types.ObjectId, ref: 'EmployeeHrLetter', default: null })
  parentLetterId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  inputData: Record<string, any>;

  /**
   * Complete, immutable rendered snapshot of the official letter at time of generation.
   * Ensures that past letters never alter if employee details change later.
   */
  @Prop({ type: SchemaTypes.Mixed, required: true })
  contentSnapshot: {
    company: {
      name: string;
      tagline?: string;
      brands?: string;
      logo?: string;
      address?: string;
      phone?: string;
      email?: string;
      website?: string;
    };
    branch?: {
      name: string;
      address?: string;
      phone?: string;
      website?: string;
    };
    letterMeta: {
      letterType: string;
      letterNumber: string;
      letterDate: string;
      titleBangla: string;
      titleEnglish?: string;
      subject: string;
    };
    recipient: {
      employeeId?: string;
      name: string;
      fatherOrHusbandName?: string;
      designation?: string;
      department?: string;
      branch?: string;
      joiningDate?: string;
      phone?: string;
      presentAddress?: string;
      permanentAddress?: string;
      nidPassport?: string;
      emergencyContact?: string;
    };
    infoTable: Array<{
      key: string;
      labelBangla: string;
      labelEnglish?: string;
      value: string;
    }>;
    sections: Array<{
      sectionNumber: string;
      titleBangla: string;
      titleEnglish?: string;
      introText?: string;
      clauses?: string[];
    }>;
    signatories: {
      issuedBy: {
        name: string;
        designation: string;
        title?: string;
      };
      approvedBy: {
        name: string;
        designation: string;
        company?: string;
        onBehalfOf?: string;
      };
      copyTo?: string[];
    };
    acknowledgementRequired: boolean;
  };

  @Prop({ trim: true })
  fileUrl?: string;

  @Prop({ trim: true })
  fileName?: string;

  @Prop({ trim: true })
  remarks?: string;

  @Prop({ trim: true })
  reissueReason?: string;

  @Prop({
    type: {
      id: { type: Types.ObjectId, ref: 'User' },
      name: String,
      role: String,
    },
    default: null,
  })
  generatedBy?: {
    id: Types.ObjectId;
    name: string;
    role: string;
  };

  @Prop({ default: Date.now })
  generatedAt: Date;
}

export const EmployeeHrLetterSchema = SchemaFactory.createForClass(EmployeeHrLetter);
EmployeeHrLetterSchema.index({ employeeId: 1, letterType: 1 });
EmployeeHrLetterSchema.index({ letterNumber: 1 }, { unique: true });
EmployeeHrLetterSchema.index({ createdAt: -1 });
