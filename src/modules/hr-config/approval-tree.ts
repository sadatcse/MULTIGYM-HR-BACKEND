// Approval hierarchies drawn on the HR Workflow settings page.
//
// A tree is a flat list of { role, parent } (parent null = top of the tree).
// A request raised by someone walks up from their role: every level above
// them recommends / verifies, and the top of the tree gives the final
// decision. The route is copied onto each request when it is raised, so
// later edits to the tree never disturb requests already in progress.

export type TreeNode = { role: string; parent: string | null };
export type ChainStep = { roles: string[]; label: string };

// Same normalisation as role checks elsewhere ("HR Admin" == "hr-admin").
export const roleKey = (role?: string) => (role || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const MAX_NODES = 100;

/** Validates a tree from the settings form: unique roles, known parents, no loops. */
export function cleanTree(input: any): TreeNode[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const nodes: TreeNode[] = [];
  const seen = new Set<string>();
  for (const n of input.slice(0, MAX_NODES)) {
    if (!n || typeof n.role !== 'string') continue;
    const role = n.role.trim().slice(0, 60);
    const key = roleKey(role);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const parent = typeof n.parent === 'string' && n.parent.trim() ? n.parent.trim().slice(0, 60) : null;
    nodes.push({ role, parent });
  }

  const byKey = new Map(nodes.map((n) => [roleKey(n.role), n]));
  for (const n of nodes) {
    if (n.parent && (!byKey.has(roleKey(n.parent)) || roleKey(n.parent) === roleKey(n.role))) n.parent = null;
  }
  // Break any loop by lifting the node where it closes to the top.
  for (const n of nodes) {
    const visited = new Set([roleKey(n.role)]);
    let p = n.parent ? byKey.get(roleKey(n.parent)) : undefined;
    while (p) {
      const key = roleKey(p.role);
      if (visited.has(key)) {
        n.parent = null;
        break;
      }
      visited.add(key);
      p = p.parent ? byKey.get(roleKey(p.parent)) : undefined;
    }
  }
  // Store parents with the exact spelling of the parent node.
  for (const n of nodes) if (n.parent) n.parent = byKey.get(roleKey(n.parent))!.role;
  return nodes;
}

/**
 * Route for a request raised by someone with `role`, nearest level first;
 * the last step gives the final decision. Empty when the tree is empty.
 */
export function buildChain(tree: TreeNode[] | null | undefined, role: string): ChainStep[] {
  if (!tree?.length) return [];
  const byKey = new Map(tree.map((n) => [roleKey(n.role), n]));
  const me = byKey.get(roleKey(role));

  // Not placed in the tree: straight to the top for a final decision.
  if (!me) {
    const tops = tree.filter((n) => !n.parent || !byKey.has(roleKey(n.parent)));
    return tops.length ? [{ roles: tops.map((t) => t.role), label: tops.map((t) => t.role).join(' / ') }] : [];
  }

  const steps: ChainStep[] = [];
  const seen = new Set([roleKey(me.role)]);
  let p = me.parent ? byKey.get(roleKey(me.parent)) : undefined;
  while (p && !seen.has(roleKey(p.role))) {
    seen.add(roleKey(p.role));
    steps.push({ roles: [p.role], label: p.role });
    p = p.parent ? byKey.get(roleKey(p.parent)) : undefined;
  }
  // Top of the tree: another person with the same role decides.
  if (!steps.length) steps.push({ roles: [me.role], label: me.role });
  return steps;
}

/** Roles anywhere below `role` in the tree (whose requests it reviews). */
export function rolesBelow(tree: TreeNode[] | null | undefined, role: string): string[] {
  if (!tree?.length) return [];
  const me = roleKey(role);
  return tree.filter((n) => buildChain(tree, n.role).some((s) => roleKey(n.role) !== me && s.roles.some((r) => roleKey(r) === me))).map((n) => n.role);
}

export type StepActor = { id: string; role: string; isSuperAdmin: boolean; scope: string; branches: string[] };

/**
 * Whether `actor` may act on a request at `currentStep` of `chain`, and if so
 * whether as the final decision. The top decision maker may finalise early.
 * Branch-limited actors only act on their own branches' requests.
 */
export function stepAccess(chain: ChainStep[] | undefined, currentStep: number, branch: string, actor: StepActor) {
  const none = { can: false, final: false, label: '' };
  if (!chain?.length || currentStep >= chain.length) return none;
  const me = roleKey(actor.role);
  const last = chain.length - 1;
  const has = (step: ChainStep) => step.roles.some((r) => roleKey(r) === me);
  const atStep = actor.isSuperAdmin || has(chain[currentStep]);
  const decider = has(chain[last]);
  if (!atStep && !decider) return none;
  if (!actor.isSuperAdmin && actor.scope === 'branch' && !actor.branches.includes(branch)) return none;
  const final = atStep ? currentStep === last : true;
  return { can: true, final, label: final ? chain[last].label : chain[currentStep].label };
}

export const stepRoleKeys = (step?: ChainStep) => (step?.roles || []).map(roleKey);
