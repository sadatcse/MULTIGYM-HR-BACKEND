import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Vendor, VendorSchema } from './src/modules/vendor/schemas/vendor.schema';

dotenv.config();

const VendorModel = mongoose.model(Vendor.name, VendorSchema);

const fakeVendors = [
  {
    name: 'Link3 Technologies Ltd.',
    category: 'Internet Service Provider & IT Infrastructure',
    website: 'https://www.link3.net',
    taxVatNumber: 'BIN-10029481234',
    status: 'active',
    notes: 'Primary high-speed dedicated fiber internet and mesh Wi-Fi network supplier for Multi Gym branches.',
    address: {
      addressLine1: 'SKS Tower, Level 9, 7 VIP Road',
      addressLine2: 'VIP Tower Extension',
      area: 'Mohakhali',
      city: 'Dhaka',
      division: 'Dhaka',
    },
    contactPerson1: {
      name: 'Tanvir Ahmed',
      designation: 'Key Account Executive',
      phone: '+8801711223344',
      email: 'tanvir.ahmed@link3.net',
    },
    contactPerson2: {
      name: 'Nusrat Jahan',
      designation: 'Technical Support Lead',
      phone: '+8801819887766',
      email: 'support@link3.net',
    },
    phones: ['+8809678123123', '+88029881234'],
    emails: ['info@link3.net', 'billing@link3.net'],
  },
  {
    name: 'Technogym Bangladesh (Fitness Equipment BD)',
    category: 'Fitness & Cardio Equipment Suppliers',
    website: 'https://www.technogym.com',
    taxVatNumber: 'BIN-20048192031',
    status: 'active',
    notes: 'Authorized supplier for commercial treadmills, skillbikes, power racks, barbells, and monthly machinery servicing.',
    address: {
      addressLine1: 'Plot 12, Road 11, Block D',
      addressLine2: 'Commercial Zone',
      area: 'Banani',
      city: 'Dhaka',
      division: 'Dhaka',
    },
    contactPerson1: {
      name: 'Mahmud Hasan',
      designation: 'Sales Manager',
      phone: '+8801912345678',
      email: 'mhasan@technogym.com.bd',
    },
    contactPerson2: {
      name: 'Rahim Uddin',
      designation: 'Equipment Maintenance Technician',
      phone: '+8801712998877',
      email: 'service@technogym.com.bd',
    },
    phones: ['+88029851122', '+8801811223344'],
    emails: ['sales@technogym.com.bd', 'maintenance@technogym.com.bd'],
  },
  {
    name: 'Optimum Nutrition BD (Ultimate Health & Fitness)',
    category: 'Nutritional Supplements & Juice Bar',
    website: 'https://www.optimumnutrition.com',
    taxVatNumber: 'BIN-30019283741',
    status: 'active',
    notes: 'Official distributor of Gold Standard Whey, Amino Energy, pre-workouts, and protein shakes for gym protein bar.',
    address: {
      addressLine1: 'House 45, Road 27, Block A',
      addressLine2: 'Gulshan Plaza',
      area: 'Gulshan 1',
      city: 'Dhaka',
      division: 'Dhaka',
    },
    contactPerson1: {
      name: 'Farhan Chowdhury',
      designation: 'Distribution Manager',
      phone: '+8801733445566',
      email: 'farhan@optimumnutrition.bd',
    },
    contactPerson2: {
      name: 'Sabrina Yeasmin',
      designation: 'Juice Bar Supply Coordinator',
      phone: '+8801611223344',
      email: 'sabrina@optimumnutrition.bd',
    },
    phones: ['+8809612345678'],
    emails: ['orders@optimumnutrition.bd', 'support@optimumnutrition.bd'],
  },
  {
    name: 'Hikvision & Dahua Security BD (Excel Telecom)',
    category: 'CCTV, Biometrics & Security Systems',
    website: 'https://www.hikvision.com',
    taxVatNumber: 'BIN-40058291023',
    status: 'active',
    notes: 'Provides 4K IP security surveillance cameras, RFID member check-in turnstiles, and biometric access hardware.',
    address: {
      addressLine1: 'Level 5, Multiplan Center, Elephant Road',
      addressLine2: 'New Market Zone',
      area: 'Dhanmondi',
      city: 'Dhaka',
      division: 'Dhaka',
    },
    contactPerson1: {
      name: 'Kazi Jalaluddin',
      designation: 'Security Systems Lead',
      phone: '+8801812341122',
      email: 'jalal@hikvision.com.bd',
    },
    contactPerson2: {
      name: 'Shahriar Kabir',
      designation: 'Biometric Turnstile Installer',
      phone: '+8801715566778',
      email: 'tech@hikvision.com.bd',
    },
    phones: ['+88029661234', '+8801700998877'],
    emails: ['cctv@hikvision.com.bd', 'support@hikvision.com.bd'],
  },
  {
    name: 'Trane & Carrier HVAC Bangladesh',
    category: 'HVAC & Air Climate Control',
    website: 'https://www.carrier.com',
    taxVatNumber: 'BIN-50069382104',
    status: 'active',
    notes: 'Commercial VRF air conditioning installation, ventilation air exchange units, and quarterly duct cleaning.',
    address: {
      addressLine1: 'Tower 8, Level 4, Tejgaon Industrial Area',
      addressLine2: 'Industrial Zone 2',
      area: 'Tejgaon',
      city: 'Dhaka',
      division: 'Dhaka',
    },
    contactPerson1: {
      name: 'Imtiaz Hossain',
      designation: 'Chief HVAC Engineer',
      phone: '+8801711998877',
      email: 'imtiaz@carrier.com.bd',
    },
    contactPerson2: {
      name: 'Monirul Islam',
      designation: 'AC Maintenance Supervisor',
      phone: '+8801911443322',
      email: 'service@carrier.com.bd',
    },
    phones: ['+88028871122', '+8801812990011'],
    emails: ['info@carrier.com.bd', 'service@carrier.com.bd'],
  },
];

async function seedVendors() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is missing in .env');
      process.exit(1);
    }

    console.log('Connecting to MongoDB database...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    console.log('Seeding 5 Online Vendors for Gym...');
    for (const vendorData of fakeVendors) {
      const existing = await VendorModel.findOne({ name: vendorData.name });

      if (existing) {
        Object.assign(existing, vendorData);
        await existing.save();
        console.log(`Updated existing vendor: "${vendorData.name}"`);
      } else {
        await VendorModel.create(vendorData);
        console.log(`Created new vendor: "${vendorData.name}"`);
      }
    }

    const totalCount = await VendorModel.countDocuments();
    console.log(`\nVendor database seeding completed successfully! Total Vendors in DB: ${totalCount}`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding vendors:', error);
    process.exit(1);
  }
}

seedVendors();
