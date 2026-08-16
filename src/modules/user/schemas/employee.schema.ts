import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type EmployeeDocument = HydratedDocument<Employee>;

@Schema({ _id: false })
export class Address {
  @Prop()
  addressLine1?: string;

  @Prop()
  addressLine2?: string;

  @Prop()
  area?: string;

  @Prop()
  division?: string;

  @Prop()
  city?: string;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

@Schema({ _id: false })
export class EmergencyContact {
  @Prop()
  name?: string;

  @Prop()
  relation?: string;

  @Prop()
  mobileNumber?: string;
}

export const EmergencyContactSchema = SchemaFactory.createForClass(EmergencyContact);

@Schema({ timestamps: true, collection: 'employees' })
export class Employee {
  @Prop({ unique: true, sparse: true, trim: true })
  employeeId?: string;

  @Prop({ required: [true, 'Please provide a name'] })
  name: string;

  @Prop({
    required: [true, 'Please provide an email address'],
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({ required: [true, 'Please provide a password'] })
  password: string;

  @Prop()
  photo?: string;

  @Prop()
  dateOfBirth?: string;

  @Prop({ enum: ['Male', 'Female', 'Other'], default: 'Male' })
  gender?: string;

  @Prop({ enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] })
  bloodGroup?: string;

  @Prop()
  nationality?: string;

  @Prop()
  nidPassport?: string;

  @Prop()
  mobileNumber?: string;

  @Prop({ type: AddressSchema })
  presentAddress?: Address;

  @Prop({ type: AddressSchema })
  permanentAddress?: Address;

  @Prop({ type: EmergencyContactSchema })
  emergencyContact?: EmergencyContact;

  @Prop()
  department?: string;

  @Prop()
  jobPosition?: string;

  @Prop({ enum: ['Full-time', 'Part-time', 'Contract'], default: 'Full-time' })
  employeeType?: string;

  @Prop()
  joiningDate?: string;

  @Prop({
    enum: ['active', 'probation', 'resigned', 'terminated', 'inactive'],
    default: 'active',
  })
  status: string;

  @Prop()
  branch?: string;

  @Prop()
  shift?: string;

  @Prop({ default: 'user' })
  role: string;

  @Prop()
  resignationDate?: string;

  @Prop()
  lastWorkingDate?: string;

  comparePassword: (enteredPassword: string) => Promise<boolean>;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);

// Hash password before saving
EmployeeSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password instance method
EmployeeSchema.methods.comparePassword = async function (enteredPassword: string) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Compatibility aliases
export type UserDocument = EmployeeDocument;
export const User = Employee;
export const UserSchema = EmployeeSchema;
