import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Employee, EmployeeSchema } from './src/modules/user/schemas/employee.schema';

dotenv.config();

const EmployeeModel = mongoose.model(Employee.name, EmployeeSchema);

const seedEmployees = [
  {
    name: 'System Administrator',
    email: 'admin@gmail.com',
    password: 'password123',
    role: 'superadmin',
    status: 'active',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    department: 'Management',
    branch: 'Main Branch',
  },
  {
    name: 'Sadat Administrator',
    email: 'sadatcse@gmail.com',
    password: '12345678',
    role: 'admin',
    status: 'active',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    department: 'IT & Security',
    branch: 'Main Branch',
  },
  {
    name: 'General Manager',
    email: 'manager@gmail.com',
    password: 'password123',
    role: 'manager',
    status: 'active',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    department: 'Operations',
    branch: 'Downtown Branch',
  },
  {
    name: 'Regular Staff',
    email: 'user@gmail.com',
    password: 'password123',
    role: 'user',
    status: 'active',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    department: 'Fitness Trainers',
    branch: 'Westside Branch',
  },
];

async function seedDatabase() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is missing in .env');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    console.log('Clearing existing employees collection...');
    await EmployeeModel.deleteMany({});
    console.log('Existing employees deleted.');

    console.log('Seeding initial employees...');
    for (const empData of seedEmployees) {
      await EmployeeModel.create(empData);
      console.log(`Created employee: ${empData.email} (${empData.role})`);
    }

    console.log('Employee database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
