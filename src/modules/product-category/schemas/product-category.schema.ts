import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProductCategoryDocument = HydratedDocument<ProductCategory>;

@Schema({ timestamps: true })
export class ProductCategory {
  @Prop({ required: [true, 'Product category title is required'], trim: true, unique: true })
  title: string;

  @Prop({ required: [true, 'Order is required'], unique: true, type: Number })
  order: number;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ trim: true, default: '' })
  description: string;
}

export const ProductCategorySchema = SchemaFactory.createForClass(ProductCategory);

ProductCategorySchema.index({ title: 1 }, { unique: true });
ProductCategorySchema.index({ order: 1 }, { unique: true });
