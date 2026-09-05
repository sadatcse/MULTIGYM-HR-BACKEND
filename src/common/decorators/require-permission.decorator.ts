import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requirePermission';

export type PermissionAction = 'view' | 'add' | 'edit' | 'delete';

export interface RequiredPermission {
  moduleKey: string;
  action: PermissionAction;
}

// moduleKey must match the `key` registered for that page in
// `MenuItems.jsx` on the frontend — PermissionsGuard and the frontend's
// PermissionsProvider `can()` check the exact same stored permission map,
// so both sides must agree on the key string.
export const RequirePermission = (moduleKey: string, action: PermissionAction = 'view') =>
  SetMetadata(PERMISSION_KEY, { moduleKey, action });
