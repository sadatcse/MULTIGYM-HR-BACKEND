import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { ProductCategory, ProductCategorySchema } from './src/modules/product-category/schemas/product-category.schema';

dotenv.config();

const ProductCategoryModel = mongoose.model(ProductCategory.name, ProductCategorySchema);

const fakeProductCategories = [
  {
    title: 'Cardio Machines & Fitness Equipment',
    order: 1,
    status: 'active',
    description: 'Commercial treadmills, skillbikes, ellipticals, rowing machines, and stair climbers.',
  },
  {
    title: 'Strength Training & Power Racks',
    order: 2,
    status: 'active',
    description: 'Power cages, olympic barbells, bumper plates, dumbbells, benches, and cable machine attachments.',
  },
  {
    title: 'Protein Powders & Supplements',
    order: 3,
    status: 'active',
    description: 'Whey protein isolate, mass gainers, casein, plant proteins, and protein bar supplies.',
  },
  {
    title: 'Pre-Workout & BCAAs',
    order: 4,
    status: 'active',
    description: 'High-energy pre-workout formulas, BCAA electrolytes, intra-workout drinks, and shaker bottles.',
  },
  {
    title: 'CCTV & Security Hardware',
    order: 5,
    status: 'active',
    description: '4K IP surveillance cameras, biometric member check-in scanners, turnstiles, and RFID cards.',
  },
  {
    title: 'Air Conditioning & HVAC Spares',
    order: 6,
    status: 'active',
    description: 'Commercial VRF AC units, ventilation fans, air filter replacements, and duct cleaning components.',
  },
  {
    title: 'Sanitation & Janitorial Supplies',
    order: 7,
    status: 'active',
    description: 'Gym wipe rolls, surface disinfectants, automatic floor scrubber parts, and locker room paper towels.',
  },
  {
    title: 'Sound & AV Entertainment Systems',
    order: 8,
    status: 'active',
    description: 'Studio sound speakers, subwoofers, wireless microphone sets, TV displays, and digital signage.',
  },
  {
    title: 'Steam Room & Sauna Supplies',
    order: 9,
    status: 'active',
    description: 'Steam generator elements, sauna wooden accessories, water descalers, and hot water boiler parts.',
  },
  {
    title: 'IT & Networking Infrastructure',
    order: 10,
    status: 'active',
    description: 'Wi-Fi mesh access points, fiber optic routers, POS barcode readers, and ethernet cabling.',
  },
];

async function seedProductCategories() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is missing in .env');
      process.exit(1);
    }

    console.log('Connecting to MongoDB database...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    console.log('Seeding Gym Product Categories...');
    for (const cat of fakeProductCategories) {
      const existing = await ProductCategoryModel.findOne({
        $or: [{ title: cat.title }, { order: cat.order }],
      });

      if (existing) {
        Object.assign(existing, cat);
        await existing.save();
        console.log(`Updated existing product category: "${cat.title}" (Order #${cat.order})`);
      } else {
        await ProductCategoryModel.create(cat);
        console.log(`Created product category: "${cat.title}" (Order #${cat.order})`);
      }
    }

    const totalCount = await ProductCategoryModel.countDocuments();
    console.log(`\nProduct category seeding completed successfully! Total in DB: ${totalCount}`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding product categories:', error);
    process.exit(1);
  }
}

seedProductCategories();
