import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Vendor, VendorSchema } from './src/modules/vendor/schemas/vendor.schema';
import { VendorPurchase, VendorPurchaseSchema } from './src/modules/vendor-purchase/schemas/vendor-purchase.schema';
import { VendorServiceRecord, VendorServiceRecordSchema } from './src/modules/vendor-service/schemas/vendor-service-record.schema';

dotenv.config();

const VendorModel = mongoose.model(Vendor.name, VendorSchema);
const PurchaseModel = mongoose.model(VendorPurchase.name, VendorPurchaseSchema);
const ServiceModel = mongoose.model(VendorServiceRecord.name, VendorServiceRecordSchema);

async function seedPurchasesAndServices() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is missing in .env');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    // Fetch existing vendors
    const vendors = await VendorModel.find({});
    if (vendors.length === 0) {
      console.log('No vendors found in database. Please run seed:vendors first.');
      process.exit(1);
    }

    const vendorMap: Record<string, any> = {};
    vendors.forEach((v) => {
      vendorMap[v.name] = v._id;
    });

    const getVendorId = (nameSub: string) => {
      const match = vendors.find((v) => v.name.toLowerCase().includes(nameSub.toLowerCase()));
      return match ? match._id : vendors[0]._id;
    };

    console.log('Seeding Vendor Purchases & Products...');

    const fakePurchases = [
      {
        vendor: getVendorId('Technogym'),
        productName: 'Technogym Excite Live Run Commercial Treadmill',
        productCategory: 'Fitness & Cardio Equipment',
        description: 'High-end commercial treadmill with 19-inch touchscreen digital console and telemetry heart rate monitor.',
        invoiceNumber: 'INV-TG-2026-001',
        purchaseOrderNumber: 'PO-2026-101',
        quantity: 4,
        unitPrice: 350000,
        totalPrice: 1400000,
        paymentStatus: 'paid',
        purchaseDate: new Date('2026-01-15'),
        paymentDate: new Date('2026-01-20'),
        branch: 'Multi Gym Premium',
        department: 'Fitness & Training',
        warranty: {
          available: true,
          startDate: new Date('2026-01-15'),
          endDate: new Date('2028-01-15'),
          durationMonths: 24,
          serialNumber: 'SN-TG-TRD-998811',
          assetId: 'AST-FIT-001',
        },
      },
      {
        vendor: getVendorId('Technogym'),
        productName: 'Technogym Skillbike Indoor Cycle & Power Rack Set',
        productCategory: 'Fitness & Cardio Equipment',
        description: 'Indoor cycling stationary bikes for group fitness classes and heavy Olympic squat racks.',
        invoiceNumber: 'INV-TG-2026-002',
        purchaseOrderNumber: 'PO-2026-104',
        quantity: 3,
        unitPrice: 220000,
        totalPrice: 660000,
        paymentStatus: 'paid',
        purchaseDate: new Date('2026-02-10'),
        paymentDate: new Date('2026-02-15'),
        branch: 'Multi Gym Main',
        department: 'Fitness & Training',
        warranty: {
          available: true,
          startDate: new Date('2026-02-10'),
          endDate: new Date('2027-02-10'),
          durationMonths: 12,
          serialNumber: 'SN-TG-BK-774422',
          assetId: 'AST-FIT-004',
        },
      },
      {
        vendor: getVendorId('Energy Generator'),
        productName: '200 kVA Perkins Diesel Backup Generator & ATS Panel',
        productCategory: 'Generator & Electrical Power Maintenance',
        description: 'Heavy duty Perkins diesel engine with automatic transfer switch (ATS) and soundproof canopy.',
        invoiceNumber: 'INV-ENG-2025-089',
        purchaseOrderNumber: 'PO-2025-044',
        quantity: 1,
        unitPrice: 950000,
        totalPrice: 950000,
        paymentStatus: 'paid',
        purchaseDate: new Date('2025-09-01'),
        paymentDate: new Date('2025-09-05'),
        branch: 'Multi Gym Premium',
        department: 'Operations',
        warranty: {
          available: true,
          startDate: new Date('2025-09-01'),
          endDate: new Date('2026-09-01'), // Expiring soon!
          durationMonths: 12,
          serialNumber: 'GEN-PERK-200KVA-881',
          assetId: 'AST-OPS-002',
        },
      },
      {
        vendor: getVendorId('Link3'),
        productName: 'Dedicated Fiber Internet 100Mbps & Managed Wi-Fi Mesh',
        productCategory: 'ISP & IT Infrastructure',
        description: 'High-speed dedicated internet bandwidth link with Cisco enterprise router & UniFi APs.',
        invoiceNumber: 'INV-L3-2026-081',
        purchaseOrderNumber: 'PO-2026-201',
        quantity: 1,
        unitPrice: 180000,
        totalPrice: 180000,
        paymentStatus: 'paid',
        purchaseDate: new Date('2026-01-01'),
        paymentDate: new Date('2026-01-05'),
        branch: 'Multi Gym Premium',
        department: 'IT & Security',
        warranty: {
          available: true,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2027-01-01'),
          durationMonths: 12,
          serialNumber: 'L3-NET-ROUTER-991',
          assetId: 'AST-IT-001',
        },
      },
      {
        vendor: getVendorId('Optimum Nutrition'),
        productName: 'Gold Standard 100% Whey Protein (5lbs Box Set)',
        productCategory: 'Nutritional Supplements & Juice Bar',
        description: 'Double Rich Chocolate whey protein tubs for gym smoothie bar & member sales.',
        invoiceNumber: 'INV-ON-2026-302',
        purchaseOrderNumber: 'PO-2026-305',
        quantity: 40,
        unitPrice: 8500,
        totalPrice: 340000,
        paymentStatus: 'partial',
        purchaseDate: new Date('2026-07-10'),
        branch: 'Multi Gym Premium',
        department: 'Front Desk Operations',
        warranty: { available: false },
      },
      {
        vendor: getVendorId('Nordic Steam'),
        productName: 'Commercial Steam Generator Unit 12kW & Sauna Heater',
        productCategory: 'Steam Room, Sauna & Spa Equipment',
        description: 'Heavy duty stainless steel steam generator unit with digital temperature controller for member spa.',
        invoiceNumber: 'INV-NS-2025-055',
        purchaseOrderNumber: 'PO-2025-099',
        quantity: 2,
        unitPrice: 240000,
        totalPrice: 480000,
        paymentStatus: 'paid',
        purchaseDate: new Date('2025-11-15'),
        paymentDate: new Date('2025-11-20'),
        branch: 'Multi Gym Main',
        department: 'Operations',
        warranty: {
          available: true,
          startDate: new Date('2025-11-15'),
          endDate: new Date('2026-11-15'), // Expiring in 2.5 months
          durationMonths: 12,
          serialNumber: 'NS-STEAM-12KW-441',
          assetId: 'AST-SPA-001',
        },
      },
      {
        vendor: getVendorId('CCTV'),
        productName: '4K Night Vision IP Camera 16-Channel NVR System',
        productCategory: 'CCTV, Biometrics & Security Systems',
        description: 'Hikvision 4K IP security cameras with 8TB surveillance hard drive NVR storage for gym floor.',
        invoiceNumber: 'INV-CCTV-2026-112',
        purchaseOrderNumber: 'PO-2026-410',
        quantity: 1,
        unitPrice: 290000,
        totalPrice: 290000,
        paymentStatus: 'paid',
        purchaseDate: new Date('2026-03-01'),
        paymentDate: new Date('2026-03-05'),
        branch: 'Multi Gym Premium',
        department: 'IT & Security',
        warranty: {
          available: true,
          startDate: new Date('2026-03-01'),
          endDate: new Date('2028-03-01'),
          durationMonths: 24,
          serialNumber: 'HIK-NVR-16CH-9922',
          assetId: 'AST-IT-003',
        },
      },
      {
        vendor: getVendorId('Cooling Systems'),
        productName: '5-Ton Commercial Inverter Cassette Air Conditioners',
        productCategory: 'HVAC & Air Climate Systems',
        description: 'Gree 5-ton ceiling cassette AC units with copper piping and outdoor compressor units.',
        invoiceNumber: 'INV-CS-2026-044',
        purchaseOrderNumber: 'PO-2026-512',
        quantity: 6,
        unitPrice: 175000,
        totalPrice: 1050000,
        paymentStatus: 'pending',
        purchaseDate: new Date('2026-06-20'),
        branch: 'Multi Gym Premium',
        department: 'Operations',
        warranty: {
          available: true,
          startDate: new Date('2026-06-20'),
          endDate: new Date('2029-06-20'),
          durationMonths: 36,
          serialNumber: 'AC-GREE-5TON-001/006',
          assetId: 'AST-HVAC-001',
        },
      },
      {
        vendor: getVendorId('Soundcraft'),
        productName: 'Professional Gym Audio System 2000W & Speakers',
        productCategory: 'Sound, AV & Digital Displays',
        description: 'Crown 2000W amplifier, JBL 10-inch ceiling speakers, and wireless microphone setup for fitness studio.',
        invoiceNumber: 'INV-SC-2026-019',
        purchaseOrderNumber: 'PO-2026-602',
        quantity: 1,
        unitPrice: 320000,
        totalPrice: 320000,
        paymentStatus: 'paid',
        purchaseDate: new Date('2026-04-12'),
        paymentDate: new Date('2026-04-15'),
        branch: 'Multi Gym Main',
        department: 'Operations',
        warranty: {
          available: true,
          startDate: new Date('2026-04-12'),
          endDate: new Date('2027-04-12'),
          durationMonths: 12,
          serialNumber: 'SC-JBL-2000W-8812',
          assetId: 'AST-AV-001',
        },
      },
      {
        vendor: getVendorId('Sportswear'),
        productName: 'Branded Staff Uniforms & Gym Trainer Dri-Fit Apparel',
        productCategory: 'Apparel, Towels & Merchandise',
        description: 'Custom embroidered polo shirts, dry-fit athletic tees, and track pants for gym trainers and receptionists.',
        invoiceNumber: 'INV-SW-2026-781',
        purchaseOrderNumber: 'PO-2026-710',
        quantity: 120,
        unitPrice: 1500,
        totalPrice: 180000,
        paymentStatus: 'paid',
        purchaseDate: new Date('2026-05-01'),
        paymentDate: new Date('2026-05-05'),
        branch: 'Multi Gym Premium',
        department: 'Human Resources',
        warranty: { available: false },
      },
      {
        vendor: getVendorId('Sanitation'),
        productName: 'Industrial Gym Disinfectant & Hand Sanitizer Dispensers',
        productCategory: 'Sanitation, Janitorial & Hygiene Supplies',
        description: 'Automatic sensor sanitizer dispensers, surface disinfectant chemicals, and micro-fiber towel sets.',
        invoiceNumber: 'INV-SAN-2026-092',
        purchaseOrderNumber: 'PO-2026-805',
        quantity: 25,
        unitPrice: 3800,
        totalPrice: 95000,
        paymentStatus: 'paid',
        purchaseDate: new Date('2026-06-01'),
        paymentDate: new Date('2026-06-03'),
        branch: 'Multi Gym Main',
        department: 'Operations',
        warranty: { available: false },
      },
    ];

    for (const pur of fakePurchases) {
      const exists = await PurchaseModel.findOne({ invoiceNumber: pur.invoiceNumber });
      if (!exists) {
        await PurchaseModel.create(pur);
        console.log(`Created purchase record: ${pur.productName} (${pur.invoiceNumber})`);
      } else {
        await PurchaseModel.updateOne({ invoiceNumber: pur.invoiceNumber }, { $set: pur });
        console.log(`Updated purchase record: ${pur.productName} (${pur.invoiceNumber})`);
      }
    }

    console.log('Seeding Vendor Maintenance Services & Warranty Records...');

    const fakeServices = [
      {
        vendor: getVendorId('Technogym'),
        serviceType: 'Quarterly Commercial Treadmill Calibration & Servicing',
        serviceDate: new Date('2026-06-15'),
        nextServiceDate: new Date('2026-09-15'),
        description: 'Lubricated running belts, inspected motor carbon brushes, calibrated speed sensors, and tightened drive belts.',
        assignedTechnician: 'Rahim Uddin',
        serviceRequestRef: 'SR-TG-2026-01',
        completionStatus: 'completed',
        serviceCost: 25000,
        branch: 'Multi Gym Premium',
        department: 'Fitness & Training',
        remarks: 'All 4 treadmills passed load tests cleanly.',
      },
      {
        vendor: getVendorId('Technogym'),
        serviceType: 'Skillbike Drive Belt & Resistance Calibration',
        serviceDate: new Date('2026-07-05'),
        nextServiceDate: new Date('2026-10-05'),
        description: 'Replaced magnetic resistance sensor on Skillbike #2 and recalibrated power output meters.',
        assignedTechnician: 'Rahim Uddin',
        serviceRequestRef: 'SR-TG-2026-04',
        completionStatus: 'completed',
        serviceCost: 15000,
        branch: 'Multi Gym Main',
        department: 'Fitness & Training',
        remarks: 'Replaced sensor under warranty terms.',
      },
      {
        vendor: getVendorId('Energy Generator'),
        serviceType: '200 kVA Generator Major Service & ATS Panel Inspection',
        serviceDate: new Date('2026-07-02'),
        nextServiceDate: new Date('2026-10-02'),
        description: 'Changed engine oil, fuel filters, air filters, coolant fluid, and tested ATS automated power switchover.',
        assignedTechnician: 'Babu Miah',
        serviceRequestRef: 'SR-ENG-2026-12',
        completionStatus: 'completed',
        serviceCost: 45000,
        branch: 'Multi Gym Premium',
        department: 'Operations',
        remarks: 'Generator battery voltage optimal at 27.2V.',
      },
      {
        vendor: getVendorId('Link3'),
        serviceType: 'Biometric Attendance Router & Network Audit',
        serviceDate: new Date('2026-08-10'),
        nextServiceDate: new Date('2026-11-10'),
        description: 'Upgraded router firmware, configured VLAN for guest Wi-Fi, and checked latency for ZKAccess biometrics.',
        assignedTechnician: 'Nusrat Jahan',
        serviceRequestRef: 'SR-L3-2026-88',
        completionStatus: 'completed',
        serviceCost: 12000,
        branch: 'Multi Gym Premium',
        department: 'IT & Security',
        remarks: 'Latency steady under 5ms.',
      },
      {
        vendor: getVendorId('Nordic Steam'),
        serviceType: 'Sauna Steamer Element Descaling & Thermostat Test',
        serviceDate: new Date('2026-08-20'),
        nextServiceDate: new Date('2026-11-20'),
        description: 'Flushed 12kW boiler tank to remove limescale deposits and replaced faulty high-limit thermostat switch.',
        assignedTechnician: 'Selim Miah',
        serviceRequestRef: 'SR-NS-2026-09',
        completionStatus: 'completed',
        serviceCost: 18500,
        branch: 'Multi Gym Main',
        department: 'Operations',
        remarks: 'Sauna temperature holds steadily at 80°C.',
      },
      {
        vendor: getVendorId('Cooling Systems'),
        serviceType: '5-Ton Cassette AC Filter Washing & Gas Top-Up',
        serviceDate: new Date('2026-08-25'),
        nextServiceDate: new Date('2026-11-25'),
        description: 'Pressure washed evaporator coils, checked R410A refrigerant pressure, and cleared condensate drain lines.',
        assignedTechnician: 'Faruk Hossain',
        serviceRequestRef: 'SR-CS-2026-33',
        completionStatus: 'in-progress',
        serviceCost: 32000,
        branch: 'Multi Gym Premium',
        department: 'Operations',
        remarks: 'Unit 3 and 4 gas pressures adjusted.',
      },
      {
        vendor: getVendorId('Soundcraft'),
        serviceType: 'Studio Audio Equalizer & Ceiling Speaker Inspection',
        serviceDate: new Date('2026-09-02'),
        nextServiceDate: new Date('2026-12-02'),
        description: 'Scheduled preventive maintenance of Crown amplifier and studio wireless microphone channels.',
        assignedTechnician: 'Kamrul Islam',
        serviceRequestRef: 'SR-SC-2026-14',
        completionStatus: 'scheduled',
        serviceCost: 8000,
        branch: 'Multi Gym Main',
        department: 'Operations',
        remarks: 'Scheduled for upcoming Tuesday morning.',
      },
      {
        vendor: getVendorId('CCTV'),
        serviceType: 'CCTV Night Vision Focus & NVR Backup Verification',
        serviceDate: new Date('2026-09-10'),
        nextServiceDate: new Date('2026-12-10'),
        description: 'Adjusted IP camera angles, cleaned outdoor dome lenses, and validated 30-day NVR video archive.',
        assignedTechnician: 'Kazi Ripon',
        serviceRequestRef: 'SR-CCTV-2026-07',
        completionStatus: 'scheduled',
        serviceCost: 15000,
        branch: 'Multi Gym Premium',
        department: 'IT & Security',
        remarks: 'Routine quarterly surveillance check.',
      },
    ];

    for (const ser of fakeServices) {
      const exists = await ServiceModel.findOne({ serviceRequestRef: ser.serviceRequestRef });
      if (!exists) {
        await ServiceModel.create(ser);
        console.log(`Created service record: ${ser.serviceType} (${ser.serviceRequestRef})`);
      } else {
        await ServiceModel.updateOne({ serviceRequestRef: ser.serviceRequestRef }, { $set: ser });
        console.log(`Updated service record: ${ser.serviceType} (${ser.serviceRequestRef})`);
      }
    }

    console.log('Vendor Purchases & Services database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding vendor purchases and services:', error);
    process.exit(1);
  }
}

seedPurchasesAndServices();
