import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type HrLetterTemplateDocument = HydratedDocument<HrLetterTemplate>;

export const HR_LETTER_TYPES = [
  'appointment',
  'confirmation',
  'promotion',
  'transfer',
  'promotion_transfer',
  'salary_revision',
  'increment',
  'warning',
  'show_cause',
  'appreciation',
  'resignation_acceptance',
  'experience_certificate',
  'relieving',
] as const;

export type HrLetterType = (typeof HR_LETTER_TYPES)[number];

@Schema({ timestamps: true, collection: 'hr_letter_templates' })
export class HrLetterTemplate {
  @Prop({
    required: true,
    enum: HR_LETTER_TYPES,
    index: true,
  })
  letterType: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  titleBangla: string;

  @Prop({ trim: true })
  titleEnglish?: string;

  @Prop({ required: true, trim: true })
  memoPrefix: string; // e.g. 'MGP/HR/APT'

  @Prop({ required: true, trim: true })
  subjectTemplate: string; // e.g. 'বিষয়ঃ {{designation}} পদে নিয়োগ প্রদান প্রসঙ্গে।'

  @Prop({ type: [Object], default: [] })
  infoFields: Array<{
    key: string;
    labelBangla: string;
    labelEnglish?: string;
    source: 'employee' | 'custom' | 'derived';
    employeeField?: string;
    required: boolean;
    defaultValue?: string;
  }>;

  @Prop({ type: [Object], default: [] })
  sections: Array<{
    sectionNumber: string;
    titleBangla: string;
    titleEnglish?: string;
    introText?: string;
    clauses?: string[];
  }>;

  @Prop({
    type: {
      issuedBy: {
        name: { type: String, default: 'মোঃ ফয়জুর রহমান মানিক' },
        designation: { type: String, default: 'Manager: Admin & HR' },
        title: { type: String, default: 'Senior Trainer' },
      },
      approvedBy: {
        name: { type: String, default: 'কর্নেল মোঃ বনী ইয়ামীন (অবঃ)' },
        designation: { type: String, default: 'পরিচালক' },
        company: { type: String, default: 'মাল্টি জিম প্রিমিয়াম ও মাল্টি জিম' },
        onBehalfOf: { type: String, default: 'পক্ষে, ব্যবস্থাপনা পরিচালক' },
      },
      copyTo: {
        type: [String],
        default: [
          'ব্যবস্থাপনা পরিচালক, মাল্টি জিম প্রিমিয়াম ও মাল্টি জিম',
          'পরিচালক, মাল্টি জিম প্রিমিয়াম ও মাল্টি জিম',
          'ম্যানেজার এডমিন',
          'ম্যানেজার একাউন্টস',
        ],
      },
    },
    default: {},
  })
  defaultSignatories: {
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
    copyTo: string[];
  };

  @Prop({ default: true })
  hasEmployeeAcknowledgment: boolean;

  @Prop({ default: true })
  isDefault: boolean;

  @Prop({ enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy?: Types.ObjectId;
}

export const HrLetterTemplateSchema = SchemaFactory.createForClass(HrLetterTemplate);
HrLetterTemplateSchema.index({ letterType: 1, isDefault: 1 });
