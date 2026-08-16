const mongoose = require('mongoose');

const uri = 'mongodb+srv://sadatcse_db_user:jUrUMC75LmUlqLeL@main.enywr5s.mongodb.net/HR?retryWrites=true&w=majority&appName=Main';

const defaultHours = {
  saturday: { open: '07:00', close: '23:00', isClosed: false },
  sunday: { open: '07:00', close: '23:00', isClosed: false },
  monday: { open: '07:00', close: '23:00', isClosed: false },
  tuesday: { open: '07:00', close: '23:00', isClosed: false },
  wednesday: { open: '07:00', close: '23:00', isClosed: false },
  thursday: { open: '07:00', close: '23:00', isClosed: false },
  friday: { open: '07:00', close: '23:00', isClosed: false },
};

async function run() {
  await mongoose.connect(uri);
  const result = await mongoose.connection.collection('branches').updateMany(
    {},
    {
      $set: {
        openingTime: '07:00',
        closingTime: '23:00',
        operatingHours: defaultHours,
      },
    }
  );
  console.log('Successfully updated branch documents:', result.modifiedCount);
  await mongoose.disconnect();
}

run().catch(console.error);
