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
  {
    name: 'CleanCare Hygiene & Janitorial Supplies',
    category: 'Sanitation, Janitorial & Hygiene Supplies',
    website: 'https://www.cleancarebd.com',
    taxVatNumber: 'BIN-60078192039',
    status: 'active',
    notes: 'Supplies commercial disinfectant wipes, automated floor scrubbing machine parts, tissue rolls, and hand sanitizers.',
    address: {
      addressLine1: 'Plot 88, Road 4, Sector 7',
      addressLine2: 'Commercial Hub',
      area: 'Uttara',
      city: 'Dhaka',
      division: 'Dhaka',
    },
    contactPerson1: {
      name: 'Anisur Rahman',
      designation: 'Corporate Accounts Manager',
      phone: '+8801712334455',
      email: 'anis@cleancarebd.com',
    },
    contactPerson2: {
      name: 'Roxana Parvin',
      designation: 'Logistics Supervisor',
      phone: '+8801819998877',
      email: 'logistics@cleancarebd.com',
    },
    phones: ['+8809611887766'],
    emails: ['sales@cleancarebd.com', 'info@cleancarebd.com'],
  },
  {
    name: 'SoundCraft Audio & AV Solutions BD',
    category: 'Sound, AV & Digital Signage Systems',
    website: 'https://www.soundcraft.com',
    taxVatNumber: 'BIN-70089201928',
    status: 'active',
    notes: 'Provides high-power studio gym speakers, wireless microphone systems for group fitness, and digital signage displays.',
    address: {
      addressLine1: 'Shop 104, Level 3, Eastern Plaza',
      addressLine2: 'Hatirpool',
      area: 'Dhanmondi',
      city: 'Dhaka',
      division: 'Dhaka',
    },
    contactPerson1: {
      name: 'Kamrul Islam',
      designation: 'Acoustic Engineer',
      phone: '+8801912887766',
      email: 'kamrul@soundcraftbd.com',
    },
    contactPerson2: {
      name: 'Tariqul Hasan',
      designation: 'AV Installation Technician',
      phone: '+8801711229988',
      email: 'support@soundcraftbd.com',
    },
    phones: ['+88029668877'],
    emails: ['info@soundcraftbd.com'],
  },
  {
    name: 'Energy Generator Power Services Ltd.',
    category: 'Generator & Electrical Power Maintenance',
    website: 'https://www.energypowerbd.com',
    taxVatNumber: 'BIN-80099182736',
    status: 'active',
    notes: '200 kVA Perkins diesel backup generator servicing, ATS panel maintenance, and heavy electrical load stabilizer.',
    address: {
      addressLine1: 'Building 14, Ring Road',
      addressLine2: 'Shyamoli',
      area: 'Adabor',
      city: 'Dhaka',
      division: 'Dhaka',
    },
    contactPerson1: {
      name: 'Babu Miah',
      designation: 'Senior Electrical Engineer',
      phone: '+8801715667788',
      email: 'babu@energypowerbd.com',
    },
    contactPerson2: {
      name: 'Zahid Hossain',
      designation: 'Emergency Maintenance Lead',
      phone: '+8801811445566',
      email: 'service@energypowerbd.com',
    },
    phones: ['+88029112233'],
    emails: ['service@energypowerbd.com'],
  },
  {
    name: 'Nordic Steam & Sauna Care BD',
    category: 'Steam Room, Sauna & Spa Maintenance',
    website: 'https://www.nordicsauna.com',
    taxVatNumber: 'BIN-90109283745',
    status: 'active',
    notes: 'Specialist contractors for commercial steam generators, cedar wood sauna room maintenance, and spa water heaters.',
    address: {
      addressLine1: 'House 19, Road 113',
      addressLine2: 'Gulshan 2',
      area: 'Gulshan',
      city: 'Dhaka',
      division: 'Dhaka',
    },
    contactPerson1: {
      name: 'Suhail Ahmed',
      designation: 'Spa Equipment Specialist',
      phone: '+8801733998877',
      email: 'suhail@nordicsauna.bd',
    },
    contactPerson2: {
      name: 'Arif Chowdhury',
      designation: 'Service Technician',
      phone: '+8801911223344',
      email: 'tech@nordicsauna.bd',
    },
    phones: ['+8809678445566'],
    emails: ['info@nordicsauna.bd'],
  },
  {
    name: 'ActiveFit Apparel & Merchandise BD',
    category: 'Apparel, Towels & Gym Merchandising',
    website: 'https://www.activefitbd.com',
    taxVatNumber: 'BIN-91119283746',
    status: 'active',
    notes: 'Custom embroidered staff polo shirts, trainer moisture-wicking tees, branded workout towels, and shaker bottles.',
    address: {
      addressLine1: 'Plot 4, Main Road, Section 6',
      addressLine2: 'Mirpur Commercial Zone',
      area: 'Mirpur',
      city: 'Dhaka',
      division: 'Dhaka',
    },
    contactPerson1: {
      name: 'Nayeem Siddique',
      designation: 'Merchandiser Lead',
      phone: '+8801812887744',
      email: 'nayeem@activefitbd.com',
    },
    contactPerson2: {
      name: 'Shirin Akter',
      designation: 'Production Coordinator',
      phone: '+8801711556677',
      email: 'production@activefitbd.com',
    },
    phones: ['+88029001122'],
    emails: ['orders@activefitbd.com'],
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

    console.log('Seeding 10 Gym Vendors...');
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
