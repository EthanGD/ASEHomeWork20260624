import { Permission } from "../auth.js";
import { query } from "../db.js";

type RoleRow = {
  id: number;
  name: string;
  description: string;
  permission_keys: Permission[];
  is_system: boolean;
  disabled: boolean;
  created_at: string;
};

export const fetchRoles = async () => {
  const result = await query<RoleRow>(
    `
      SELECT id, name, description, permission_keys, is_system, disabled, created_at
      FROM roles
      ORDER BY is_system DESC, created_at ASC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    permissions: row.permission_keys,
    system: row.is_system,
    disabled: row.disabled,
    createdAt: row.created_at
  }));
};
