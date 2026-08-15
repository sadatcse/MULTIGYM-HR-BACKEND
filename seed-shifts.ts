import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Shift, ShiftSchema } from './src/modules/shift/schemas/shift.schema';

dotenv.config();

const ShiftModel = mongoose.model(Shift.name, ShiftSchema);

const seedShifts = [
  {
    name: 'Morning Shift',
    order: 1,
    description: 'Standard morning operational shift for trainers and facility staff (6:00 AM - 2:00 PM).',
    status: 'active',
  },
  {
    name: 'Evening Shift',
    order: 2,
    description: 'Peak evening operational shift covering gym peak hours (2:00 PM - 10:00 PM).',
    status: 'active',
  },
  {
    name: 'Custom Shift',
    order: 3,
    description: 'Flexible or part-time customized roster shift scheduled on demand.',
    status: 'active',
  },
  {
    name: 'Full Shift',
    order: 4,
    description: 'Full-day comprehensive operational coverage shift (8:00 AM - 8:00 PM).',
    status: 'active',
  },
];

async function seedShiftsDatabase() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is missing in .env');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    for (const shiftData of seedShifts) {
      const exists = await ShiftModel.findOne({ name: shiftData.name });
      if (!exists) {
        await ShiftModel.create(shiftData);
        console.log(`Seeded shift: ${shiftData.name}`);
      } else {
        console.log(`Shift already exists: ${shiftData.name}`);
      }
    }

    console.log('Shifts seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding shifts:', error);
    process.exit(1);
  }
}

seedShiftsDatabase();
