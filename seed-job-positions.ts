import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { JobPosition, JobPositionSchema } from './src/modules/job-position/schemas/job-position.schema';

dotenv.config();

const JobPositionModel = mongoose.model(JobPosition.name, JobPositionSchema);

const seedPositions = [
  {
    title: 'Director',
    order: 0,
    department: 'Executive Management',
    description: 'Executive leadership responsible for strategic vision, operational oversight, governance, and corporate growth.',
    status: 'active',
  },
  {
    title: 'Senior Personal Trainer',
    order: 1,
    department: 'Fitness & Training',
    description: 'Lead personal trainer overseeing customized workout programs, client retention, and fitness evaluations.',
    status: 'active',
  },
  {
    title: 'Fitness Instructor',
    order: 2,
    department: 'Fitness & Training',
    description: 'Conducts group fitness classes, spinning sessions, and strength training instruction for gym members.',
    status: 'active',
  },
  {
    title: 'Front Desk Executive',
    order: 3,
    department: 'Front Desk Operations',
    description: 'Handles member check-ins, facility inquiries, membership renewals, and visitor assistance.',
    status: 'active',
  },
  {
    title: 'Branch Operations Manager',
    order: 4,
    department: 'Management & Operations',
    description: 'Supervises daily gym operations, staff scheduling, equipment maintenance, and member satisfaction.',
    status: 'active',
  },
  {
    title: 'HR & Payroll Specialist',
    order: 5,
    department: 'Human Resources',
    description: 'Manages staff attendance records, monthly payroll processing, trainer commissions, and recruitment.',
    status: 'active',
  },
  {
    title: 'Nutritionist & Wellness Coach',
    order: 6,
    department: 'Fitness & Training',
    description: 'Provides personalized dietary plans, meal counseling, and nutritional wellness guidance to members.',
    status: 'active',
  },
];

async function seedJobPositions() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is missing in .env');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    for (const posData of seedPositions) {
      try {
        await JobPositionModel.findOneAndUpdate(
          { title: posData.title },
          { $setOnInsert: posData },
          { upsert: true, new: true }
        );
        console.log(`Job position checked/upserted: ${posData.title}`);
      } catch (err: any) {
        console.log(`Skipped position ${posData.title}: ${err.message}`);
      }
    }

    console.log('Job positions seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding job positions:', error);
    process.exit(1);
  }
}

seedJobPositions();
