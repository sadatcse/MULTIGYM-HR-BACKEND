import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GymAssetLocation, GymAssetLocationSchema } from './schemas/gym-asset-location.schema';
import { GymAsset, GymAssetSchema } from './schemas/gym-asset.schema';
import { GymAssetPlace, GymAssetPlaceSchema } from './schemas/gym-asset-place.schema';
import { GymAssetCategory, GymAssetCategorySchema } from './schemas/gym-asset-category.schema';
import {
  GymAssetCounter,
  GymAssetCounterSchema,
  GymAssetDisposal,
  GymAssetDisposalSchema,
  GymAssetHistory,
  GymAssetHistorySchema,
  GymAssetMaintenance,
  GymAssetMaintenanceSchema,
  GymAssetTransfer,
  GymAssetTransferSchema,
} from './schemas/gym-asset-records.schema';
import { GymAssetCoreService } from './gym-asset-core.service';
import { GymAssetSetupService } from './gym-asset-setup.service';
import { GymAssetService } from './gym-asset.service';
import { GymAssetOpsService } from './gym-asset-ops.service';
import { GymAssetReportService } from './gym-asset-report.service';
import { GymAssetController } from './gym-asset.controller';

// Fixed-asset register for the gyms, warehouse and head office: locations,
// places, categories, assets, transfers, maintenance, disposal, history and
// reports. Self-contained: no links to HR branches, staff or uniform stock.
// Only the signed-in user (who recorded what) and role permissions are shared.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GymAsset.name, schema: GymAssetSchema },
      { name: GymAssetPlace.name, schema: GymAssetPlaceSchema },
      { name: GymAssetCategory.name, schema: GymAssetCategorySchema },
      { name: GymAssetTransfer.name, schema: GymAssetTransferSchema },
      { name: GymAssetMaintenance.name, schema: GymAssetMaintenanceSchema },
      { name: GymAssetDisposal.name, schema: GymAssetDisposalSchema },
      { name: GymAssetHistory.name, schema: GymAssetHistorySchema },
      { name: GymAssetCounter.name, schema: GymAssetCounterSchema },
      { name: GymAssetLocation.name, schema: GymAssetLocationSchema },
    ]),
  ],
  controllers: [GymAssetController],
  providers: [GymAssetCoreService, GymAssetSetupService, GymAssetService, GymAssetOpsService, GymAssetReportService],
})
export class GymAssetModule {}
