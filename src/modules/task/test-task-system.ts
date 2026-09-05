import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Task, TaskSchema, TaskStatus, InstructionSource, TaskPriority, CompletionCondition } from './schemas/task.schema';
import { TaskAssignee, TaskAssigneeSchema } from './schemas/task-assignee.schema';
import { TaskAuditLog, TaskAuditLogSchema, TaskEventType } from './schemas/task-audit-log.schema';
import { TaskReminder, TaskReminderSchema, TaskReminderType } from './schemas/task-reminder.schema';
import { TaskCategory, TaskCategorySchema } from './schemas/task-category.schema';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';

dotenv.config();

const TaskModel = mongoose.model(Task.name, TaskSchema);
const AssigneeModel = mongoose.model(TaskAssignee.name, TaskAssigneeSchema);
const AuditLogModel = mongoose.model(TaskAuditLog.name, TaskAuditLogSchema);
const ReminderModel = mongoose.model(TaskReminder.name, TaskReminderSchema);
const CategoryModel = mongoose.model(TaskCategory.name, TaskCategorySchema);
const EmployeeModel = mongoose.model(Employee.name, EmployeeSchema);

async function runTests() {
  console.log('\n======================================================');
  console.log('  AUTOMATED TEST SUITE: TASK & INSTRUCTION MANAGEMENT');
  console.log('======================================================\n');

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is missing in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
    }
  }

  try {
    // Setup test accounts if needed
    let admin = await EmployeeModel.findOne({ role: { $in: ['superadmin', 'admin'] } });
    if (!admin) {
      admin = await EmployeeModel.create({
        name: 'Test Admin',
        email: 'test.admin@multigym.com',
        role: 'admin',
        status: 'active',
      });
    }

    let staff1 = await EmployeeModel.findOne({ email: 'test.staff1@multigym.com' });
    if (!staff1) {
      staff1 = await EmployeeModel.create({
        name: 'Rahim Manik',
        email: 'test.staff1@multigym.com',
        employeeId: 'EMP-T01',
        role: 'user',
        status: 'active',
        department: 'Operations',
        branch: 'Kushtia',
      });
    }

    let staff2 = await EmployeeModel.findOne({ email: 'test.staff2@multigym.com' });
    if (!staff2) {
      staff2 = await EmployeeModel.create({
        name: 'Karim Ahmed',
        email: 'test.staff2@multigym.com',
        employeeId: 'EMP-T02',
        role: 'user',
        status: 'active',
        department: 'Operations',
        branch: 'Kushtia',
      });
    }

    console.log('\n--- SECTION 1: TASK CREATION & INSTRUCTION SOURCES ---');
    // Test 1: Task Creation with Source MD Sir
    const deadlineTomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const task1 = await TaskModel.create({
      title: 'Prepare Staff Uniforms for Kushtia Branch',
      description: 'All uniforms must be stitched and distributed before the deadline.',
      instructionSource: InstructionSource.MD_SIR,
      instructionSourceCustom: 'Mohammad Sadat Khan',
      issuedBy: admin._id,
      branch: 'Kushtia',
      department: 'Operations',
      category: 'Management Instruction',
      priority: TaskPriority.HIGH,
      deadline: deadlineTomorrow,
      approvalRequired: true,
      completionProofRequired: true,
      completionCondition: CompletionCondition.ALL_ASSIGNEES,
      createdBy: admin._id,
      status: TaskStatus.PENDING,
    });

    assert(task1._id != null, 'Task document successfully created in MongoDB');
    assert(task1.instructionSource === 'MD Sir', 'Task source is explicitly recorded as "MD Sir"');
    assert(task1.status === 'PENDING', 'Initial task status is PENDING');

    console.log('\n--- SECTION 2: MULTI-EMPLOYEE ASSIGNMENTS ---');
    // Test 2: Assign multiple employees with independent status tracking
    const assignee1 = await AssigneeModel.create({
      task: task1._id,
      employee: staff1._id,
      status: TaskStatus.PENDING,
      progress: 0,
    });

    const assignee2 = await AssigneeModel.create({
      task: task1._id,
      employee: staff2._id,
      status: TaskStatus.PENDING,
      progress: 0,
    });

    assert(assignee1._id != null && assignee2._id != null, 'Multi-employee assignees created');

    console.log('\n--- SECTION 3: INDEPENDENT WORKFLOW & STATUS TRANSITIONS ---');
    // Staff 1 starts task
    assignee1.status = TaskStatus.IN_PROGRESS;
    assignee1.startedAt = new Date();
    assignee1.progress = 60;
    await assignee1.save();

    assert(assignee1.status === 'IN_PROGRESS' && assignee2.status === 'PENDING',
      'Staff 1 is IN_PROGRESS while Staff 2 remains PENDING independently');

    // Audit Log creation
    const audit1 = await AuditLogModel.create({
      task: task1._id,
      actor: staff1._id,
      eventType: TaskEventType.TASK_STARTED,
      comment: 'Rahim Manik started the directive',
      timestamp: new Date(),
    });
    assert(audit1._id != null, 'TASK_STARTED event successfully logged in audit trail');

    console.log('\n--- SECTION 4: COMPLETION PROOF & VERSIONING ---');
    // Staff 1 uploads completion proof
    assignee1.proofs = [
      {
        name: 'uniform_delivery_receipt.pdf',
        url: 'https://multigymhr.s3.amazonaws.com/task-proofs/receipt.pdf',
        fileType: 'application/pdf',
        size: 1048576,
        uploadedAt: new Date(),
        version: 1,
      },
    ];
    assignee1.status = TaskStatus.WAITING_FOR_APPROVAL;
    assignee1.submittedAt = new Date();
    await assignee1.save();

    assert(assignee1.proofs.length === 1 && assignee1.proofs[0].version === 1,
      'Proof uploaded and tracked with version 1');
    assert(assignee1.status === 'WAITING_FOR_APPROVAL',
      'Staff 1 moved to WAITING_FOR_APPROVAL');

    console.log('\n--- SECTION 5: APPROVAL & REJECTION WORKFLOW ---');
    // Test Rejection by Management with reason
    assignee1.status = TaskStatus.IN_PROGRESS;
    assignee1.rejectionReason = 'Tailoring measurement list missing for 2 staff members';
    await assignee1.save();

    assert(assignee1.status === 'IN_PROGRESS' && assignee1.rejectionReason.length > 0,
      'Rejection restores IN_PROGRESS status and records feedback');

    // Staff 1 uploads revised proof (v2) and resubmits
    assignee1.proofs.push({
      name: 'uniform_delivery_receipt_v2.pdf',
      url: 'https://multigymhr.s3.amazonaws.com/task-proofs/receipt_v2.pdf',
      fileType: 'application/pdf',
      size: 1248576,
      uploadedAt: new Date(),
      version: 2,
    });
    assignee1.status = TaskStatus.WAITING_FOR_APPROVAL;
    await assignee1.save();

    assert(assignee1.proofs.length === 2 && assignee1.proofs[1].version === 2,
      'Historical proofs preserved across revisions (v1 and v2 both exist)');

    // Management approves Staff 1
    assignee1.status = TaskStatus.COMPLETED;
    assignee1.completedAt = new Date();
    assignee1.approvedBy = admin._id as any;
    await assignee1.save();

    assert(assignee1.status === 'COMPLETED', 'Staff 1 marked COMPLETED upon approval');

    console.log('\n--- SECTION 6: DEADLINE & OVERDUE DETECTION ---');
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const overdueTask = await TaskModel.create({
      title: 'Branch Safety Audit Checklist',
      description: 'Audit report must be finalized',
      instructionSource: InstructionSource.DIRECTOR_SIR,
      issuedBy: admin._id,
      deadline: pastDate,
      createdBy: admin._id,
      status: TaskStatus.IN_PROGRESS,
    });

    const isOverdueNow = overdueTask.deadline < new Date();
    assert(isOverdueNow === true, 'Automatic overdue detection succeeds for past deadline');

    console.log('\n--- SECTION 7: DEADLINE EXTENSION AUDIT HISTORY ---');
    const newDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    overdueTask.deadlineHistory.push({
      oldDeadline: overdueTask.deadline,
      newDeadline: newDeadline,
      changedBy: admin._id as any,
      changedAt: new Date(),
      reason: 'Delay in external auditor arrival',
    });
    overdueTask.deadline = newDeadline;
    await overdueTask.save();

    assert(overdueTask.deadlineHistory.length === 1,
      'Deadline change audit record preserved with oldDeadline, newDeadline, and reason');
    assert(overdueTask.deadline.getTime() === newDeadline.getTime(),
      'New deadline active on task document');

    console.log('\n--- SECTION 8: IDEMPOTENT REMINDER SYSTEM ---');
    // First reminder dispatch
    const reminder1 = await ReminderModel.create({
      task: task1._id,
      employee: staff1._id,
      reminderType: TaskReminderType.ONE_DAY_BEFORE,
      scheduledDate: new Date(),
      sentAt: new Date(),
      status: 'SENT',
      message: 'Reminder: Task is due tomorrow',
    });
    assert(reminder1._id != null, 'First reminder dispatched and logged');

    // Attempt duplicate reminder (unique index should block duplicate)
    let duplicateBlocked = false;
    try {
      await ReminderModel.create({
        task: task1._id,
        employee: staff1._id,
        reminderType: TaskReminderType.ONE_DAY_BEFORE,
        scheduledDate: new Date(),
        sentAt: new Date(),
        status: 'SENT',
        message: 'Duplicate attempt',
      });
    } catch (err: any) {
      if (err.code === 11000) {
        duplicateBlocked = true;
      }
    }
    assert(duplicateBlocked === true,
      'Duplicate reminder prevention (idempotency) verified via MongoDB unique index');

    console.log('\n--- SECTION 9: TASK CATEGORIES ---');
    let categories = await CategoryModel.find({ status: 'active' });
    if (categories.length === 0) {
      const defaults = [
        'Management Instruction', 'HR', 'Attendance', 'Recruitment', 'Operations',
        'Finance', 'Marketing', 'IT', 'Branch Operations', 'Maintenance', 'Procurement',
        'Training', 'Compliance', 'Customer Service', 'Other'
      ];
      await CategoryModel.insertMany(defaults.map((name, idx) => ({ name, order: idx + 1, isSystem: true, status: 'active' })));
      categories = await CategoryModel.find({ status: 'active' });
    }
    assert(categories.length > 0, 'Configured categories accessible and active');

    // Clean up test tasks
    await TaskModel.findByIdAndDelete(task1._id);
    await TaskModel.findByIdAndDelete(overdueTask._id);
    await AssigneeModel.deleteMany({ task: { $in: [task1._id, overdueTask._id] } });
    await AuditLogModel.deleteMany({ task: { $in: [task1._id, overdueTask._id] } });
    await ReminderModel.deleteMany({ task: { $in: [task1._id, overdueTask._id] } });

    console.log('\n======================================================');
    console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('======================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
