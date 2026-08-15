import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RolePermissionDocument = RolePermission & Document;

@Schema({ timestamps: true })
export class RolePermission {
  @Prop({ required: [true, 'Role is required'], trim: true, uppercase: true, unique: true })
  role: string;

  @Prop({
    type: Map,
    of: {
      view: { type: Boolean, default: false },
      add: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    default: {},
  })
  permissions: Map<string, { view: boolean; add: boolean; edit: boolean; delete: boolean }>;
}

export const RolePermissionSchema = SchemaFactory.createForClass(RolePermission);
RolePermissionSchema.index({ role: 1 }, { unique: true });
