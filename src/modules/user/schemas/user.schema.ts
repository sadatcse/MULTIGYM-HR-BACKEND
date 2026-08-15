import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
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

  @Prop({ required: [true, 'Please provide a name'] })
  name: string;

  @Prop({ enum: ['admin', 'user', 'manager', 'superadmin'], default: 'user' })
  role: string;

  @Prop({ enum: ['active', 'inactive'], default: 'active' })
  status: string;

  comparePassword: (enteredPassword: string) => Promise<boolean>;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Hash the password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next(); // Skip if password not modified
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Add a method to compare passwords
UserSchema.methods.comparePassword = async function (enteredPassword: string) {
  return bcrypt.compare(enteredPassword, this.password);
};
