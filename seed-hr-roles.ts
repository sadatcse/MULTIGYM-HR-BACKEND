// Creates the HR role set and a starting permission matrix for the new HR
// modules. Safe to re-run: roles are upserted by name, and permissions are
// MERGED per module key — existing entries for other modules are untouched,
// and an existing entry for one of these keys is only filled in, never
// overwritten (pass --overwrite to reset these keys to the defaults below).
//
//   npx ts-node -r tsconfig-paths/register seed-hr-roles.ts [--dry-run] [--overwrite]
//
// Data scope (own branch / own records) and approval-stage roles are set in
// the web app under Security & Access → HR Workflow Settings.
import 'dotenv/config';
import mongoose from 'mongoose';

type Perm = { view: boolean; add: boolean; edit: boolean; delete: boolean };
const P = (s: string): Perm => ({ view: s.includes('v'), add: s.includes('a'), edit: s.includes('e'), delete: s.includes('d') });

const SELF_KEYS = ['my-attendance', 'my-roster', 'my-leave', 'my-payslips', 'my-notices', 'my-requisitions'];
const HR_KEYS = [
  'employee-history', 'branch-overview', 'attendance', 'attendance-report', 'attendance-corrections', 'attendance-devices',
  'duty-roster', 'leave-approvals', 'leave-applications', 'leave-register', 'leave-details',
  'payroll', 'salary-structures', 'employee-loans', 'requisitions', 'requisition-create', 'requisition-details',
  'discipline', 'discipline-details', 'hr-workflow-config',
];

function matrix(rules: Record<string, string>, fallback = ''): Record<string, Perm> {
  const out: Record<string, Perm> = {};
  for (const k of [...SELF_KEYS, ...HR_KEYS]) out[k] = P(rules[k] ?? fallback);
  return out;
}

const ROLES: Array<{ name: string; description: string; perms: Record<string, Perm> }> = [
  { name: 'Managing Director', description: 'Full access', perms: matrix({}, 'vaed') },
  { name: 'Director', description: 'Management & approval access', perms: matrix({ 'hr-workflow-config': 'v', 'attendance-devices': 'v' }, 'vae') },
  { name: 'Manager (Admin & HR)', description: 'HR + admin operational access', perms: matrix({ 'hr-workflow-config': 've' }, 'vaed') },
  { name: 'General Manager', description: 'Assigned access', perms: matrix({ 'hr-workflow-config': '', 'attendance-devices': 'v', discipline: 'v', 'discipline-details': 'v', payroll: 'v', 'salary-structures': 'v', 'employee-loans': 'v' }, 'vae') },
  {
    name: 'Branch In-Charge',
    description: 'Own branch access (floor in-charge)',
    perms: matrix({ 'my-attendance': 'v', 'my-roster': 'v', 'my-leave': 'va', 'my-payslips': 'v', 'my-notices': 'v', 'branch-overview': 'v', attendance: 've', 'attendance-report': 'v', 'attendance-corrections': 'v', 'duty-roster': 'vaed', 'leave-approvals': 've', 'leave-applications': 'v', 'leave-details': 'v', 'leave-register': 'v', requisitions: 'va', 'requisition-create': 'va', 'requisition-details': 'v', 'employee-history': 'v' }),
  },
  {
    name: 'Front Desk',
    description: 'Limited attendance / operational access',
    perms: matrix({ 'my-attendance': 'v', 'my-roster': 'v', 'my-leave': 'va', 'my-payslips': 'v', 'my-notices': 'v', attendance: 'v', 'duty-roster': 'v', requisitions: 'va', 'requisition-create': 'va', 'requisition-details': 'v' }),
  },
  {
    name: 'Employee',
    description: 'Own profile, attendance, leave & notices',
    perms: matrix({ 'my-attendance': 'v', 'my-roster': 'v', 'my-leave': 'va', 'my-payslips': 'v', 'my-notices': 'v', 'leave-details': 'v' }),
  },
];

async function main() {
  const dry = process.argv.includes('--dry-run');
  const overwrite = process.argv.includes('--overwrite');
  await mongoose.connect(String(process.env.MONGO_URI).trim());
  const db = mongoose.connection.db!;
  const roles = db.collection('roles');
  const perms = db.collection('rolepermissions');
  let order = ((await roles.find().sort({ order: -1 }).limit(1).toArray())[0]?.order || 0) + 1;

  for (const r of ROLES) {
    const existing = await roles.findOne({ name: { $regex: `^${r.name.replace(/[()]/g, '\\$&')}$`, $options: 'i' } });
    if (!existing) {
      console.log(`+ role ${r.name}`);
      if (!dry) await roles.insertOne({ name: r.name, order: order++, status: 'active', description: r.description, createdAt: new Date(), updatedAt: new Date() });
    }
    const key = r.name.toUpperCase();
    const doc = await perms.findOne({ role: key });
    const current = (doc?.permissions || {}) as Record<string, Perm>;
    const merged = { ...current };
    let changed = 0;
    for (const [k, v] of Object.entries(r.perms)) {
      if (overwrite || !current[k]) {
        merged[k] = v;
        changed++;
      }
    }
    console.log(`  ${key}: ${changed} module permission(s) ${dry ? 'would be ' : ''}set`);
    if (!dry && changed) await perms.updateOne({ role: key }, { $set: { permissions: merged, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  }
  console.log(dry ? 'Dry run — nothing written.' : 'Done.');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
