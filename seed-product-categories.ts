import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { ProductCategory, ProductCategorySchema } from './src/modules/product-category/schemas/product-category.schema';

dotenv.config();

const ProductCategoryModel = mongoose.model(ProductCategory.name, ProductCategorySchema);

const fakeProductCategories = [
  {
    title: 'Tissue & Hygiene Paper Products',
    order: 1,
    status: 'active',
    description: 'Hand towels, facial tissues, toilet paper rolls, and dispenser refill packs for restrooms and workout floor.',
  },
  {
    title: 'Electrical & Wiring Supplies',
    order: 2,
    status: 'active',
    description: 'Heavy-duty extension cords, LED panel bulbs, switches, circuit breakers, and electrical wiring components.',
  },
  {
    title: 'Cardio Machines & Fitness Equipment',
    order: 3,
    status: 'active',
    description: 'Commercial treadmills, skillbikes, ellipticals, rowing machines, and stairmaster stepmills.',
  },
  {
    title: 'Strength Training & Power Racks',
    order: 4,
    status: 'active',
    description: 'Olympic barbells, weight plates, rubber dumbbells, power cages, and cable crossover attachments.',
  },
  {
    title: 'Nutritional Supplements & Protein Powders',
    order: 5,
    status: 'active',
    description: 'Whey protein isolate, mass gainers, casein, plant proteins, and protein bar stock for gym nutrition counter.',
  },
  {
    title: 'Pre-Workout & BCAAs',
    order: 6,
    status: 'active',
    description: 'High-caffeine pre-workout powders, BCAA electrolyte mixes, energy drinks, and shaker bottles.',
  },
  {
    title: 'Cleaning & Disinfectant Supplies',
    order: 7,
    status: 'active',
    description: 'Disinfectant wipes, floor cleaning chemicals, spray bottles, mops, and automatic floor scrubber parts.',
  },
  {
    title: 'CCTV & Security Hardware',
    order: 8,
    status: 'active',
    description: '4K IP security cameras, NVR recorders, biometric member check-in scanners, turnstiles, and RFID cards.',
  },
  {
    title: 'Air Conditioning & HVAC Parts',
    order: 9,
    status: 'active',
    description: 'Commercial VRF AC units, air filters, refrigerant gas cylinders, blower motors, and duct spares.',
  },
  {
    title: 'Steam Room & Sauna Accessories',
    order: 10,
    status: 'active',
    description: 'Steam generator heating elements, sauna rocks, wooden buckets, ladles, and temperature sensors.',
  },
  {
    title: 'Towels, Linens & Laundry Supplies',
    order: 11,
    status: 'active',
    description: 'Microfiber workout towels, bath towels, laundry detergent, fabric softeners, and laundry hampers.',
  },
  {
    title: 'Sound & AV Entertainment Systems',
    order: 12,
    status: 'active',
    description: 'Studio sound speakers, subwoofers, wireless headsets, TV monitors, digital signage, and audio amplifiers.',
  },
  {
    title: 'Plumbing & Shower Fixtures',
    order: 13,
    status: 'active',
    description: 'Shower heads, hot water boilers, drainage traps, water pressure pumps, and faucet valves.',
  },
  {
    title: 'Water Dispensers & Filtration',
    order: 14,
    status: 'active',
    description: 'Commercial reverse-osmosis (RO) water purifiers, UV filter cartridges, and cold water dispenser parts.',
  },
  {
    title: 'First Aid & Medical Emergency',
    order: 15,
    status: 'active',
    description: 'First aid kits, AED defibrillator accessories, ice packs, bandages, antiseptic sprays, and muscle pain gels.',
  },
  {
    title: 'Locker Room & Storage Lockers',
    order: 16,
    status: 'active',
    description: 'Digital combination locks, RFID wristbands, master key sets, locker hinges, and bench seating.',
  },
  {
    title: 'Apparel & Gym Merchandising',
    order: 17,
    status: 'active',
    description: 'Branded staff polo shirts, trainer vests, wrist wraps, lifting belts, and promotional gym merchandise.',
  },
  {
    title: 'Generator & Power Backup Parts',
    order: 18,
    status: 'active',
    description: 'Diesel backup generator filters, engine oil, battery chargers, and automatic transfer switches (ATS).',
  },
  {
    title: 'IT Hardware & POS Terminals',
    order: 19,
    status: 'active',
    description: 'Receipt printers, barcode scanners, desktop computers, Wi-Fi mesh access points, and router hardware.',
  },
  {
    title: 'Stationery & Office Supplies',
    order: 20,
    status: 'active',
    description: 'Member registration forms, printed invoice pads, pens, binders, ID card printers, and lamination pouches.',
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

    console.log('Seeding 20 Gym Product Categories...');
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
