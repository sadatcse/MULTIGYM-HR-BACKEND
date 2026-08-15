import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { User, UserSchema } from './src/modules/user/schemas/user.schema';

dotenv.config();

const UserModel = mongoose.model(User.name, UserSchema);

const seedUsers = [
  {
    name: 'System Administrator',
    email: 'admin@gmail.com',
    password: 'password123',
    role: 'superadmin',
    status: 'active',
    photo: 'https://i.ibb.co/sample-avatar.png',
  },
  {
    name: 'System Administrator',
    email: 'sadatcse@gmail.com',
    password: '12345678',
    role: 'admin',
    status: 'active',
    photo: 'https://i.ibb.co/sample-avatar.png',
  },
  {
    name: 'General Manager',
    email: 'manager@gmail.com',
    password: 'password123',
    role: 'manager',
    status: 'active',
    photo: 'https://i.ibb.co/sample-avatar.png',
  },
  {
    name: 'Regular Staff',
    email: 'user@gmail.com',
    password: 'password123',
    role: 'user',
    status: 'active',
    photo: 'https://i.ibb.co/sample-avatar.png',
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

    console.log('Clearing existing users collection...');
    await UserModel.deleteMany({});
    console.log('Existing users deleted.');

    console.log('Seeding initial users...');
    for (const userData of seedUsers) {
      await UserModel.create(userData);
      console.log(`Created user: ${userData.email} (${userData.role})`);
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
