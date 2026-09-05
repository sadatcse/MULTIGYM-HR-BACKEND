import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssetAssignmentService } from './asset-assignment.service';
import { AssetAssignmentController } from './asset-assignment.controller';
import { AssetAssignment, AssetAssignmentSchema } from './schemas/asset-assignment.schema';
import { Asset, AssetSchema } from '../asset/schemas/asset.schema';
import { AssetType, AssetTypeSchema } from '../asset-type/schemas/asset-type.schema';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';

import { AssetTransactionModule } from '../asset-transaction/asset-transaction.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssetAssignment.name, schema: AssetAssignmentSchema },
      { name: Asset.name, schema: AssetSchema },
      { name: AssetType.name, schema: AssetTypeSchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
    AssetTransactionModule,
  ],
  controllers: [AssetAssignmentController],
  providers: [AssetAssignmentService],
  exports: [AssetAssignmentService],
})
export class AssetAssignmentModule {}
