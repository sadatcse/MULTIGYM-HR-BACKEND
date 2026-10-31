import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssetLocationService } from './asset-location.service';
import { AssetLocationController } from './asset-location.controller';
import { AssetLocation, AssetLocationSchema } from './schemas/asset-location.schema';
import { Asset, AssetSchema } from '../asset/schemas/asset.schema';
import { AssetAssignment, AssetAssignmentSchema } from '../asset-assignment/schemas/asset-assignment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssetLocation.name, schema: AssetLocationSchema },
      { name: Asset.name, schema: AssetSchema },
      { name: AssetAssignment.name, schema: AssetAssignmentSchema },
    ]),
  ],
  controllers: [AssetLocationController],
  providers: [AssetLocationService],
  exports: [AssetLocationService],
})
export class AssetLocationModule {}
