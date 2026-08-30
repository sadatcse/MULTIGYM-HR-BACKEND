import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssetTypeService } from './asset-type.service';
import { AssetTypeController } from './asset-type.controller';
import { AssetType, AssetTypeSchema } from './schemas/asset-type.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: AssetType.name, schema: AssetTypeSchema }])],
  controllers: [AssetTypeController],
  providers: [AssetTypeService],
  exports: [AssetTypeService],
})
export class AssetTypeModule {}
