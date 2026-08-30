import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssetService } from './asset.service';
import { AssetController } from './asset.controller';
import { Asset, AssetSchema } from './schemas/asset.schema';
import { AssetAssignment, AssetAssignmentSchema } from '../asset-assignment/schemas/asset-assignment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Asset.name, schema: AssetSchema },
      { name: AssetAssignment.name, schema: AssetAssignmentSchema },
    ]),
  ],
  controllers: [AssetController],
  providers: [AssetService],
  exports: [AssetService],
})
export class AssetModule {}
