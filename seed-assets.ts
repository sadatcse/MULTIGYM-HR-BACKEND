import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { AssetType, AssetTypeSchema } from './src/modules/asset-type/schemas/asset-type.schema';
import { Asset, AssetSchema } from './src/modules/asset/schemas/asset.schema';
import { AssetAssignment, AssetAssignmentSchema } from './src/modules/asset-assignment/schemas/asset-assignment.schema';
import { Employee, EmployeeSchema } from './src/modules/user/schemas/employee.schema';

dotenv.config();

const AssetTypeModel = mongoose.model(AssetType.name, AssetTypeSchema);
const AssetModel = mongoose.model(Asset.name, AssetSchema);
const AssetAssignmentModel = mongoose.model(AssetAssignment.name, AssetAssignmentSchema);
const EmployeeModel = mongoose.model(Employee.name, EmployeeSchema);

const fakeAssetTypes = [
  {
    name: 'Staff Uniform T-Shirt',
    category: 'Uniform & Identification',
    trackingType: 'inventory',
    returnable: false,
    order: 1,
    status: 'active',
    description: 'Standard gym staff uniform moisture-wicking t-shirt',
    replacementIntervalMonths: 6,
  },
  {
    name: 'Trainer Performance Polo',
    category: 'Uniform & Identification',
    trackingType: 'inventory',
    returnable: false,
    order: 2,
    status: 'active',
    description: 'Personal trainer polo shirt with Multi Gym logo',
    replacementIntervalMonths: 6,
  },
  {
    name: 'Front Desk Access RFID Card',
    category: 'Keys',
    trackingType: 'inventory',
    returnable: true,
    order: 3,
    status: 'active',
    description: 'Master RFID smart card for gym entry and POS counter access',
  },
  {
    name: 'Facility Master Key Set',
    category: 'Keys',
    trackingType: 'individual',
    returnable: true,
    order: 4,
    status: 'active',
    description: 'Physical master keys for gym entrance, office, and electrical control room',
  },
  {
    name: 'Management Laptop (Dell Latitude)',
    category: 'Company Assets',
    trackingType: 'individual',
    returnable: true,
    order: 5,
    status: 'active',
    description: 'Company laptop issued to gym managers and system administrators',
  },
  {
    name: 'Fitness Assessment Tablet (iPad Air)',
    category: 'Company Assets',
    trackingType: 'individual',
    returnable: true,
    order: 6,
    status: 'active',
    description: 'Tablet device used by trainers for body composition & fitness assessments',
  },
  {
    name: 'POS Barcode Scanner',
    category: 'Company Assets',
    trackingType: 'individual',
    returnable: true,
    order: 7,
    status: 'active',
    description: 'Wireless handheld barcode scanner for retail inventory & supplement sales',
  },
  {
    name: 'Biometric Staff Attendance Reader',
    category: 'Company Assets',
    trackingType: 'individual',
    returnable: true,
    order: 8,
    status: 'active',
    description: 'Portable biometric fingerprint scanner for staff check-in',
  },
  {
    name: 'Walkie-Talkie Radio Set',
    category: 'Company Assets',
    trackingType: 'individual',
    returnable: true,
    order: 9,
    status: 'active',
    description: 'Two-way radio communication set for floor security and trainers',
  },
  {
    name: 'AED Emergency Defibrillator Unit',
    category: 'Company Assets',
    trackingType: 'individual',
    returnable: true,
    order: 10,
    status: 'active',
    description: 'Medical defibrillator unit assigned to emergency response lead',
  },
];

async function seedAssets() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is missing in .env');
      process.exit(1);
    }

    console.log('Connecting to MongoDB database...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    // 1. Seed Asset Types
    console.log('\n--- 1. Seeding Asset Types ---');
    const createdTypesMap: Record<string, any> = {};

    for (const typeData of fakeAssetTypes) {
      let typeDoc = await AssetTypeModel.findOne({
        $or: [{ name: typeData.name }, { order: typeData.order }],
      });

      if (typeDoc) {
        Object.assign(typeDoc, typeData);
        await typeDoc.save();
        console.log(`Updated Asset Type: "${typeData.name}"`);
      } else {
        typeDoc = await AssetTypeModel.create(typeData);
        console.log(`Created Asset Type: "${typeData.name}"`);
      }
      createdTypesMap[typeData.name] = typeDoc;
    }

    // 2. Seed Assets
    console.log('\n--- 2. Seeding Asset Directory Items ---');
    const fakeAssets = [
      {
        assetType: createdTypesMap['Staff Uniform T-Shirt']?._id,
        assetCode: 'AST-UNIF-L01',
        description: 'Black Gym Staff T-Shirt',
        size: 'L',
        quantityTotal: 25,
        purchaseDate: new Date('2026-01-15'),
        condition: 'New',
        status: 'available',
        notes: 'In stock at central storage',
      },
      {
        assetType: createdTypesMap['Trainer Performance Polo']?._id,
        assetCode: 'AST-POLO-M02',
        description: 'Red Trainer Polo Shirt',
        size: 'M',
        quantityTotal: 15,
        purchaseDate: new Date('2026-01-20'),
        condition: 'New',
        status: 'available',
        notes: 'In stock at trainer room',
      },
      {
        assetType: createdTypesMap['Front Desk Access RFID Card']?._id,
        assetCode: 'AST-RFID-101',
        description: 'Master RFID Smart Keycard',
        quantityTotal: 10,
        purchaseDate: new Date('2026-02-01'),
        condition: 'Good',
        status: 'available',
        notes: 'Front desk spare cards',
      },
      {
        assetType: createdTypesMap['Facility Master Key Set']?._id,
        assetCode: 'AST-KEY-M01',
        description: 'Master Key Set (Main Gym, Control Room, Manager Office)',
        serialNumber: 'KEY-2026-M01',
        quantityTotal: 1,
        purchaseDate: new Date('2026-01-05'),
        condition: 'Good',
        status: 'assigned',
        notes: 'Issued to General Manager',
      },
      {
        assetType: createdTypesMap['Management Laptop (Dell Latitude)']?._id,
        assetCode: 'AST-LAP-001',
        description: 'Dell Latitude 5430 Core i7 16GB 512GB SSD',
        serialNumber: 'SN-DELL-998822',
        quantityTotal: 1,
        purchaseDate: new Date('2025-11-10'),
        condition: 'Good',
        status: 'assigned',
        notes: 'Issued to System Administrator for HR management',
      },
      {
        assetType: createdTypesMap['Fitness Assessment Tablet (iPad Air)']?._id,
        assetCode: 'AST-TAB-001',
        description: 'iPad Air 5th Gen 64GB Wi-Fi Space Gray',
        serialNumber: 'SN-IPAD-776655',
        quantityTotal: 1,
        purchaseDate: new Date('2025-12-15'),
        condition: 'Good',
        status: 'assigned',
        notes: 'Issued for member body assessments',
      },
      {
        assetType: createdTypesMap['POS Barcode Scanner']?._id,
        assetCode: 'AST-POS-001',
        description: 'Zebra DS2278 Wireless 2D Barcode Scanner',
        serialNumber: 'SN-ZEB-334455',
        quantityTotal: 1,
        purchaseDate: new Date('2026-01-10'),
        condition: 'Good',
        status: 'available',
        notes: 'Juice bar & supplement checkout desk',
      },
      {
        assetType: createdTypesMap['Biometric Staff Attendance Reader']?._id,
        assetCode: 'AST-BIO-001',
        description: 'ZKTeco SilkFP-100TA Biometric Terminal',
        serialNumber: 'SN-ZK-112233',
        quantityTotal: 1,
        purchaseDate: new Date('2025-10-20'),
        condition: 'Good',
        status: 'assigned',
        notes: 'Staff check-in terminal',
      },
      {
        assetType: createdTypesMap['Walkie-Talkie Radio Set']?._id,
        assetCode: 'AST-RADIO-01',
        description: 'Motorola CP200d UHF Two-Way Radio',
        serialNumber: 'SN-MOT-445566',
        quantityTotal: 1,
        purchaseDate: new Date('2026-01-02'),
        condition: 'Good',
        status: 'available',
        notes: 'Floor security radio handset',
      },
      {
        assetType: createdTypesMap['AED Emergency Defibrillator Unit']?._id,
        assetCode: 'AST-AED-001',
        description: 'Philips HeartStart FRx AED Defibrillator Unit',
        serialNumber: 'SN-PHIL-889900',
        quantityTotal: 1,
        purchaseDate: new Date('2025-09-15'),
        condition: 'Good',
        status: 'available',
        notes: 'First aid wall cabinet location',
      },
    ];

    const createdAssetsMap: Record<string, any> = {};

    for (const assetData of fakeAssets) {
      if (!assetData.assetType) continue;
      let assetDoc = await AssetModel.findOne({ assetCode: assetData.assetCode });

      if (assetDoc) {
        Object.assign(assetDoc, assetData);
        await assetDoc.save();
        console.log(`Updated Asset Item: "${assetData.assetCode}" (${assetData.description})`);
      } else {
        assetDoc = await AssetModel.create(assetData);
        console.log(`Created Asset Item: "${assetData.assetCode}" (${assetData.description})`);
      }
      createdAssetsMap[assetData.assetCode] = assetDoc;
    }

    // 3. Seed Asset Assignments & Exit Clearances
    console.log('\n--- 3. Seeding Asset Assignments & Exit Clearance Records ---');
    const employees = await EmployeeModel.find().exec();
    if (employees.length > 0) {
      const adminEmp = employees.find((e) => e.role === 'superadmin' || e.email === 'admin@gmail.com') || employees[0];
      const managerEmp = employees.find((e) => e.role === 'manager' || e.email === 'manager@gmail.com') || employees[0];
      const userEmp = employees.find((e) => e.role === 'user' || e.email === 'user@gmail.com') || employees[employees.length - 1];

      const assignmentsData = [
        {
          employee: adminEmp._id,
          asset: createdAssetsMap['AST-LAP-001']?._id,
          quantity: 1,
          issueDate: new Date('2026-01-10'),
          issueCondition: 'Good',
          issuedBy: 'HR Admin',
          issueNotes: 'Company laptop issued for system administration',
          status: 'active',
          damageOrLoss: 'none',
        },
        {
          employee: adminEmp._id,
          asset: createdAssetsMap['AST-TAB-001']?._id,
          quantity: 1,
          issueDate: new Date('2026-01-15'),
          issueCondition: 'Good',
          issuedBy: 'HR Admin',
          issueNotes: 'Fitness assessment tablet',
          status: 'active',
          damageOrLoss: 'none',
        },
        {
          employee: managerEmp._id,
          asset: createdAssetsMap['AST-KEY-M01']?._id,
          quantity: 1,
          issueDate: new Date('2026-01-05'),
          issueCondition: 'Good',
          issuedBy: 'System Admin',
          issueNotes: 'Master facility key set',
          status: 'active',
          damageOrLoss: 'none',
        },
        {
          employee: userEmp._id,
          asset: createdAssetsMap['AST-RADIO-01']?._id,
          quantity: 1,
          issueDate: new Date('2026-01-02'),
          issueCondition: 'Good',
          issuedBy: 'Floor Manager',
          issueNotes: 'Security radio for duty shift',
          status: 'returned',
          returnDate: new Date('2026-02-15'),
          returnCondition: 'Good',
          returnedTo: 'HR Manager',
          returnNotes: 'Returned in good condition during exit clearance',
          damageOrLoss: 'none',
        },
      ];

      for (const assignment of assignmentsData) {
        if (!assignment.employee || !assignment.asset) continue;

        const existing = await AssetAssignmentModel.findOne({
          employee: assignment.employee,
          asset: assignment.asset,
          issueDate: assignment.issueDate,
        });

        if (existing) {
          Object.assign(existing, assignment);
          await existing.save();
          console.log(`Updated Asset Assignment record for Employee ID: ${assignment.employee}`);
        } else {
          await AssetAssignmentModel.create(assignment);
          console.log(`Created Asset Assignment record for Employee ID: ${assignment.employee}`);
        }
      }
    }

    const totalAssetTypes = await AssetTypeModel.countDocuments();
    const totalAssets = await AssetModel.countDocuments();
    const totalAssignments = await AssetAssignmentModel.countDocuments();

    console.log(`\n======================================================`);
    console.log(`Asset Management Seeding Completed Successfully!`);
    console.log(`- Total Asset Types in DB: ${totalAssetTypes}`);
    console.log(`- Total Assets in Directory: ${totalAssets}`);
    console.log(`- Total Asset Assignment / Clearance Records: ${totalAssignments}`);
    console.log(`======================================================\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding assets:', error);
    process.exit(1);
  }
}

seedAssets();
