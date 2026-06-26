import { hashPassword } from "./auth.js";
import { config } from "./config.js";
import { query } from "./db.js";
const ADMIN_PERMISSIONS = [
    "task:view_all",
    "task:edit_all",
    "task:manage_own",
    "user:manage",
    "role:manage",
    "settings:manage"
];
const EMPLOYEE_PERMISSIONS = ["task:manage_own"];
export const ensureDatabase = async () => {
    await query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      permission_keys TEXT[] NOT NULL DEFAULT '{}',
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      disabled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      password_hash TEXT,
      display_name TEXT NOT NULL,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'enabled',
      auth_source TEXT NOT NULL DEFAULT 'local',
      wechat_open_id TEXT UNIQUE,
      deleted BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    await query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );
  `);
    await query(`
    CREATE TABLE IF NOT EXISTS oauth_identities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      provider_username TEXT,
      provider_email TEXT,
      raw_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (provider, provider_user_id),
      UNIQUE (user_id, provider)
    );
  `);
    await query(`
    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL,
      public_key_jwk JSONB NOT NULL DEFAULT '{}'::jsonb,
      sign_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (credential_id),
      UNIQUE (user_id, credential_id)
    );
  `);
    await query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      start_at TIMESTAMPTZ,
      end_at TIMESTAMPTZ,
      created_by INTEGER NOT NULL REFERENCES users(id),
      updated_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    await query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    const adminRole = await query(`
      INSERT INTO roles(name, description, permission_keys, is_system)
      VALUES ($1, $2, $3::text[], TRUE)
      ON CONFLICT (name)
      DO UPDATE SET description = EXCLUDED.description, permission_keys = EXCLUDED.permission_keys
      RETURNING id
    `, ["超级管理员", "拥有系统全部权限", ADMIN_PERMISSIONS]);
    const employeeRole = await query(`
      INSERT INTO roles(name, description, permission_keys, is_system)
      VALUES ($1, $2, $3::text[], TRUE)
      ON CONFLICT (name)
      DO UPDATE SET description = EXCLUDED.description, permission_keys = EXCLUDED.permission_keys
      RETURNING id
    `, ["普通员工", "只能管理自己的事务", EMPLOYEE_PERMISSIONS]);
    const adminPasswordHash = await hashPassword("admin123");
    const demoPasswordHash = await hashPassword("demo123");
    const adminUser = await query(`
      INSERT INTO users(username, password_hash, display_name, email, auth_source)
      VALUES ($1, $2, $3, $4, 'local')
      ON CONFLICT (username)
      DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email
      RETURNING id
    `, ["admin", adminPasswordHash, "系统管理员", "admin@example.com"]);
    const demoUser = await query(`
      INSERT INTO users(username, password_hash, display_name, email, auth_source)
      VALUES ($1, $2, $3, $4, 'local')
      ON CONFLICT (username)
      DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email
      RETURNING id
    `, ["demo", demoPasswordHash, "示例员工", "demo@example.com"]);
    await query(`
      INSERT INTO user_roles(user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [adminUser.rows[0].id, adminRole.rows[0].id]);
    await query(`
      INSERT INTO user_roles(user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [demoUser.rows[0].id, employeeRole.rows[0].id]);
    await query(`
      INSERT INTO system_settings(key, value)
      VALUES (
        'app',
        $1::jsonb
      )
      ON CONFLICT (key) DO NOTHING
    `, [
        JSON.stringify({
            integrations: {
                funasrServiceUrl: "",
                funasrApiPath: "/recognize",
                funasrToken: "",
                wechatAppId: config.wechat.appId,
                ssoEnabled: false,
                ssoProvider: "企业微信 / OAuth"
            }
        })
    ]);
    const taskCount = await query(`SELECT COUNT(*)::text AS count FROM tasks`);
    if (Number(taskCount.rows[0].count) === 0) {
        await query(`
        INSERT INTO tasks(title, content, status, priority, start_at, end_at, created_by, updated_by)
        VALUES
          ($1, $2, 'todo', 'high', NOW(), NOW() + INTERVAL '1 hour', $3, $3),
          ($4, $5, 'in_progress', 'medium', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours', $6, $6)
      `, [
            "整理今天的客户回访事项",
            "优先联系 A 类客户，确认回访结果并补充备注。",
            adminUser.rows[0].id,
            "补充会议中的待办任务",
            "上传录音后通过 funASR 生成文本，再拆分为多条事务。",
            demoUser.rows[0].id
        ]);
    }
};
