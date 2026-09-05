import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { TaskCategory, TaskCategorySchema } from './src/modules/task/schemas/task-category.schema';

dotenv.config();

const TaskCategoryModel = mongoose.model(TaskCategory.name, TaskCategorySchema);

export const DEFAULT_TASK_CATEGORIES_DATA = [
  {
    name: 'Management Instruction',
    description: 'Direct high-priority directives issued from MD Sir, Director Sir, or Executive Board.',
    color: '#D4AF37',
    order: 1,
    status: 'active',
    isSystem: true,
  },
  {
    name: 'HR & Personnel',
    description: 'Human resources policies, employee onboarding, grievances, documentation, and appraisals.',
    color: '#3B82F6',
    order: 2,
    status: 'active',
    isSystem: true,
  },
  {
    name: 'Attendance & Roster',
    description: 'Shift rosters, duty assignments, biometric attendance regularizations, and late compliance.',
    color: '#8B5CF6',
    order: 3,
    status: 'active',
    isSystem: true,
  },
  {
    name: 'Recruitment & Hiring',
    description: 'Candidate screening, interview schedules, background verifications, and trainer hiring.',
    color: '#06B6D4',
    order: 4,
    status: 'active',
    isSystem: true,
  },
  {
    name: 'Gym Operations',
    description: 'Day-to-day floor operations, member check-in workflows, branch coordination, and operating standards.',
    color: '#10B981',
    order: 5,
    status: 'active',
    isSystem: true,
  },
  {
    name: 'Finance & Accounts',
    description: 'Daily cash collections, expense vouchers, vendor bills, audit checks, and salary disbursements.',
    color: '#EAB308',
    order: 6,
    status: 'active',
    isSystem: true,
  },
  {
    name: 'Sales & Marketing',
    description: 'Promotional campaigns, membership renewal drives, digital ads, and social media announcements.',
    color: '#EC4899',
    order: 7,
    status: 'active',
    isSystem: true,
  },
  {
    name: 'IT & Software',
    description: 'Network uptime, biometric device sync, software bug fixes, backups, and CCTV systems.',
    color: '#6366F1',
    order: 8,
    status: 'active',
    isSystem: true,
  },
  {
    name: 'Branch Operations',
    description: 'Specific branch audits, Dhanmondi, Gulshan, Banani, and Uttara operational requests.',
    color: '#14B8A6',
    order: 9,
    status: 'active',
    isSystem: true,
  },
  {
    name: 'Maintenance & Repairs',
    description: 'Gym equipment servicing, treadmill motor overhauls, HVAC climate servicing, and plumbing.',
    color: '#F97316',
    order: 10,
    status: 'active',
    isSystem: true,
  },
  {
    name: 'Procurement & Inventory',
    description: 'Purchase orders for gym accessories, sanitation supplies, uniforms, and office consumables.',
    color: '#84CC16',
    order: 11,
    status: 'active',
    isSystem: true,
  },
  {
    name: 'Staff Training',
    description: 'Fitness trainer certifications, customer service workshops, and CPR/First-Aid trainings.',
    color: '#A855F7',
    order: 12,
    status: 'active',
    isSystem: true,
  },
  {
    name: 'Statutory & Compliance',
    description: 'Trade licenses, fire safety audits, health inspection certificates, and legal compliance.',
    color: '#EF4444',
    order: 13,
    status: 'active',
    isSystem: true,
  },
  {
    name: 'Customer Service & Feedback',
    description: 'Member complaints resolution, towel/locker room complaints, and satisfaction surveys.',
    color: '#0EA5E9',
    order: 14,
    status: 'active',
    isSystem: true,
  },
  {
    name: 'General & Miscellaneous',
    description: 'Ad-hoc tasks, cross-departmental coordination, and general administrative follow-ups.',
    color: '#64748B',
    order: 15,
    status: 'active',
    isSystem: true,
  },
];

async function seedTaskCategories() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');
    console.log(`Seeding ${DEFAULT_TASK_CATEGORIES_DATA.length} Task Categories as fake / default data...`);

    let inserted = 0;
    let updated = 0;

    for (const cat of DEFAULT_TASK_CATEGORIES_DATA) {
      const res = await TaskCategoryModel.findOneAndUpdate(
        { name: cat.name },
        {
          $set: {
            description: cat.description,
            color: cat.color,
            order: cat.order,
            status: cat.status,
            isSystem: cat.isSystem,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      if (res) {
        inserted++;
      }
    }

    const totalCount = await TaskCategoryModel.countDocuments();
    console.log(`\nTask Category seeding completed successfully! Total categories in database: ${totalCount}`);
  } catch (error) {
    console.error('Error seeding task categories:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  }
}

seedTaskCategories();
