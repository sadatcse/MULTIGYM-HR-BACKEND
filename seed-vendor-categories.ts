import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { VendorCategory, VendorCategorySchema } from './src/modules/vendor-category/schemas/vendor-category.schema';

dotenv.config();

const VendorCategoryModel = mongoose.model(VendorCategory.name, VendorCategorySchema);

const fakeVendorCategories = [
  {
    title: 'Fitness & Cardio Equipment Suppliers',
    order: 1,
    status: 'active',
    description: 'Suppliers and maintenance contractors for treadmills, ellipticals, power racks, barbells, plates, and cable strength machines.',
  },
  {
    title: 'Nutritional Supplements & Juice Bar',
    order: 2,
    status: 'active',
    description: 'Vendors supplying whey protein, pre-workout supplements, BCAAs, energy drinks, protein bars, and health bar items.',
  },
  {
    title: 'HVAC & Air Climate Control',
    order: 3,
    status: 'active',
    description: 'Heating, ventilation, air conditioning maintenance, duct cleaning, and humidity control contractors for workout zones.',
  },
  {
    title: 'CCTV, Biometrics & Security Systems',
    order: 4,
    status: 'active',
    description: 'Vendors for turnstiles, biometric member check-in scanners, security surveillance cameras, and access control hardware.',
  },
  {
    title: 'Sanitation, Janitorial & Hygiene Supplies',
    order: 5,
    status: 'active',
    description: 'Industrial disinfectant wipes, locker room hygiene supplies, automated floor scrubbers, and commercial laundry services.',
  },
  {
    title: 'Sound, AV & Digital Signage Systems',
    order: 6,
    status: 'active',
    description: 'Acoustic sound system installers, studio speakers, workout music licensing, TV monitors, and digital promotional displays.',
  },
  {
    title: 'Steam Room, Sauna & Spa Maintenance',
    order: 7,
    status: 'active',
    description: 'Maintenance contractors for steam generators, sauna wooden bench repairs, spa water filtration, and hot water boilers.',
  },
  {
    title: 'Internet Service Provider & IT Infrastructure',
    order: 8,
    status: 'active',
    description: 'Dedicated high-speed fiber internet providers, Wi-Fi mesh access points, network routers, and POS hardware support.',
  },
  {
    title: 'Apparel, Towels & Gym Merchandising',
    order: 9,
    status: 'active',
    description: 'Suppliers of branded staff polo shirts, trainer gear, workout towels, shaker bottles, and gym branded merchandise.',
  },
  {
    title: 'Generator & Electrical Power Maintenance',
    order: 10,
    status: 'active',
    description: 'High-capacity diesel backup generator servicing, electrical circuit panel maintenance, and heavy-duty lighting contractors.',
  },
];

async function seedVendorCategories() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is missing in .env');
      process.exit(1);
    }

    console.log('Connecting to MongoDB database...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    console.log('Seeding Gym Vendor Categories...');
    for (const cat of fakeVendorCategories) {
      const existing = await VendorCategoryModel.findOne({
        $or: [{ title: cat.title }, { order: cat.order }],
      });

      if (existing) {
        Object.assign(existing, cat);
        await existing.save();
        console.log(`Updated existing category: "${cat.title}" (Order #${cat.order})`);
      } else {
        await VendorCategoryModel.create(cat);
        console.log(`Created vendor category: "${cat.title}" (Order #${cat.order})`);
      }
    }

    const totalCount = await VendorCategoryModel.countDocuments();
    console.log(`\nVendor category seeding completed successfully! Total categories in database: ${totalCount}`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding vendor categories:', error);
    process.exit(1);
  }
}

seedVendorCategories();
