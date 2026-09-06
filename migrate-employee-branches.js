// One-time migration: Employee.branch (string) -> Employee.branches (string[])
// Usage: node migrate-employee-branches.js [--dry-run]
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not found in environment');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const employees = db.collection('employees');

  const total = await employees.countDocuments();
  const withBranchField = await employees.countDocuments({ branch: { $exists: true } });
  const alreadyMigrated = await employees.countDocuments({ branches: { $exists: true } });
  console.log(`Total employees: ${total}`);
  console.log(`With old 'branch' field: ${withBranchField}`);
  console.log(`Already has 'branches' field: ${alreadyMigrated}`);

  console.log('\n--- BEFORE sample (first 5 with a branch value) ---');
  const beforeSample = await employees.find({ branch: { $exists: true, $ne: '' } }).project({ name: 1, employeeId: 1, branch: 1 }).limit(5).toArray();
  beforeSample.forEach((e) => console.log(`  ${e.name} (${e.employeeId || 'no-id'}): branch="${e.branch}"`));

  if (process.argv.includes('--dry-run')) {
    console.log('\nDry run only, no writes performed.');
    await client.close();
    return;
  }

  const cursor = employees.find({});
  let migrated = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const oldBranch = typeof doc.branch === 'string' && doc.branch.trim() ? doc.branch.trim() : null;
    await employees.updateOne(
      { _id: doc._id },
      {
        $set: { branches: oldBranch ? [oldBranch] : (Array.isArray(doc.branches) ? doc.branches : []) },
        $unset: { branch: '' },
      }
    );
    migrated++;
  }
  console.log(`\nMigrated ${migrated} employee documents.`);

  console.log('\n--- AFTER sample (same employees) ---');
  const ids = beforeSample.map((e) => e._id);
  const afterSample = await employees.find({ _id: { $in: ids } }).project({ name: 1, employeeId: 1, branches: 1, branch: 1 }).toArray();
  afterSample.forEach((e) => console.log(`  ${e.name} (${e.employeeId || 'no-id'}): branches=${JSON.stringify(e.branches)} (old branch field present: ${e.branch !== undefined})`));

  const finalWithOldField = await employees.countDocuments({ branch: { $exists: true } });
  const finalWithBranches = await employees.countDocuments({ branches: { $exists: true } });
  console.log(`\nFinal: ${finalWithOldField} still have old 'branch' field (should be 0), ${finalWithBranches} now have 'branches' field (should be ${total}).`);

  await client.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
