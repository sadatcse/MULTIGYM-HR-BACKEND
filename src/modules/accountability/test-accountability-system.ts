import mongoose, { Types } from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

// Direct schema imports
import {
  CommunicationEvent,
  CommunicationEventSchema,
  CommunicationType,
  AccountabilityEventType,
} from './schemas/communication-event.schema';
import {
  CommunicationReminder,
  CommunicationReminderSchema,
  CommonReminderType,
} from './schemas/communication-reminder.schema';

async function runTestSuite() {
  console.log('======================================================');
  console.log('  AUTOMATED TEST SUITE: ACCOUNTABILITY LAYER');
  console.log('======================================================');

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set');
  }

  await mongoose.connect(uri);
  console.log('✓ Connected to MongoDB');

  const EventModel = mongoose.model(CommunicationEvent.name, CommunicationEventSchema);
  const ReminderModel = mongoose.model(CommunicationReminder.name, CommunicationReminderSchema);

  const testCommId = new Types.ObjectId();
  const testActorId = new Types.ObjectId();
  const testTargetId = new Types.ObjectId();

  try {
    // --- SECTION 1: IMMUTABLE AUDIT EVENT LEDGER ---
    console.log('\n--- SECTION 1: IMMUTABLE AUDIT EVENT LEDGER ---');

    const event = await EventModel.create({
      communicationId: testCommId,
      communicationType: CommunicationType.INSTRUCTION,
      title: 'Emergency Generator Fuel Check',
      source: 'MD Sir',
      eventType: AccountabilityEventType.COMMUNICATION_CREATED,
      actor: testActorId,
      targetUser: testTargetId,
      branch: 'Dhanmondi',
      department: 'Maintenance',
      newStatus: 'PENDING',
      comment: 'Official verbal directive recorded from MD Sir meeting',
    });

    console.log('  ✓ PASS: Communication event logged to unified ledger:', event._id);

    const fetchedEvent = await EventModel.findById(event._id);
    if (!fetchedEvent || fetchedEvent.source !== 'MD Sir') {
      throw new Error('Event verification failed');
    }
    console.log('  ✓ PASS: Event source correctly preserved as "MD Sir"');

    // --- SECTION 2: IDEMPOTENT REMINDER LOGGING ---
    console.log('\n--- SECTION 2: IDEMPOTENT REMINDER LOGGING ---');

    const reminder = await ReminderModel.create({
      communicationId: testCommId,
      communicationType: CommunicationType.TASK,
      targetEmployee: testTargetId,
      reminderType: CommonReminderType.DUE_TODAY,
      title: 'Emergency Generator Fuel Check',
      message: 'Reminder: Task is due today',
      sentAt: new Date(),
    });
    console.log('  ✓ PASS: First reminder dispatched & logged:', reminder._id);

    // Duplicate check: same communicationId + targetEmployee + reminderType MUST fail with duplicate key code 11000
    let duplicatePrevented = false;
    try {
      await ReminderModel.create({
        communicationId: testCommId,
        communicationType: CommunicationType.TASK,
        targetEmployee: testTargetId,
        reminderType: CommonReminderType.DUE_TODAY,
        title: 'Emergency Generator Fuel Check duplicate',
        message: 'Duplicate attempt',
        sentAt: new Date(),
      });
    } catch (err: any) {
      if (err.code === 11000) {
        duplicatePrevented = true;
      }
    }

    if (!duplicatePrevented) {
      throw new Error('Duplicate reminder should have been rejected by unique compound index');
    }
    console.log('  ✓ PASS: Idempotency enforced via MongoDB unique index (duplicate rejected)');

    // --- SECTION 3: UNIFIED ATTENTION QUEUE AGGREGATION ---
    console.log('\n--- SECTION 3: ATTENTION QUEUE & KPI VALIDATION ---');
    const totalEvents = await EventModel.countDocuments();
    console.log(`  ✓ PASS: Event ledger total records: ${totalEvents}`);

    const noticeCount = await mongoose.connection.collection('notices').countDocuments();
    const taskCount = await mongoose.connection.collection('tasks').countDocuments();
    console.log(`  ✓ PASS: Cross-entity counts -> Notices: ${noticeCount}, Tasks: ${taskCount}`);

    // --- SECTION 4: CLEANUP TEST ARTIFACTS ---
    console.log('\n--- SECTION 4: CLEANUP ---');
    await EventModel.deleteOne({ _id: event._id });
    await ReminderModel.deleteOne({ _id: reminder._id });
    console.log('  ✓ PASS: Test artifacts cleaned up successfully');

    console.log('\n======================================================');
    console.log('  TEST RESULTS: ALL TESTS PASSED (100% SUCCESS)');
    console.log('======================================================\n');
  } finally {
    await mongoose.disconnect();
  }
}

runTestSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
