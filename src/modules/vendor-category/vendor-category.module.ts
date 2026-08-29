import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorCategoryService } from './vendor-category.service';
import { VendorCategoryController } from './vendor-category.controller';
import { VendorCategory, VendorCategorySchema } from './schemas/vendor-category.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: VendorCategory.name, schema: VendorCategorySchema }])],
  controllers: [VendorCategoryController],
  providers: [VendorCategoryService],
  exports: [VendorCategoryService],
})
export class VendorCategoryModule {}
