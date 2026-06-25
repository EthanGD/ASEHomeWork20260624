import { query } from "../db.js";
export const fetchUsers = async () => {
    const result = await query(`
      SELECT
        u.id,
        u.username,
        u.display_name,
        u.email,
        u.status,
        u.auth_source,
        (u.wechat_open_id IS NOT NULL) AS wechat_bound,
        EXISTS (
          SELECT 1
          FROM oauth_identities oi
          WHERE oi.user_id = u.id AND oi.provider = 'github'
        ) AS github_bound,
        u.deleted,
        COALESCE(array_agg(DISTINCT r.id) FILTER (WHERE r.id IS NOT NULL), '{}') AS role_ids,
        COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.id IS NOT NULL), '{}') AS role_names,
        u.created_at
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.deleted = FALSE
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    return result.rows.map((row) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        email: row.email,
        status: row.status,
        authSource: row.auth_source,
        wechatBound: row.wechat_bound,
        githubBound: row.github_bound,
        roleIds: row.role_ids ?? [],
        roleNames: row.role_names ?? [],
        createdAt: row.created_at
    }));
};
