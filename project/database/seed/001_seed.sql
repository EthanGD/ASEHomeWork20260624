INSERT INTO roles(name, description, permission_keys, is_system)
VALUES
  ('超级管理员', '拥有系统全部权限', ARRAY['task:view_all','task:edit_all','task:manage_own','user:manage','role:manage','settings:manage'], TRUE),
  ('普通员工', '只能管理自己的事务', ARRAY['task:manage_own'], TRUE)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    permission_keys = EXCLUDED.permission_keys;

INSERT INTO users(username, password_hash, display_name, email, auth_source)
VALUES
  ('admin', '$2b$10$W569b0heyeBQ0KJerme21umit9Tun.p13ryfV5bfTUN5lNOFj19rq', '系统管理员', 'admin@example.com', 'local'),
  ('demo', '$2b$10$fH7OHj66B7hyBwMnszpqG.CDq2tk7pw.xL/XKZRz7xonwxAoiup82', '示例员工', 'demo@example.com', 'local')
ON CONFLICT (username) DO UPDATE
SET display_name = EXCLUDED.display_name,
    email = EXCLUDED.email;

INSERT INTO user_roles(user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = '超级管理员'
WHERE u.username = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles(user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = '普通员工'
WHERE u.username = 'demo'
ON CONFLICT DO NOTHING;

INSERT INTO system_settings(key, value)
VALUES (
  'app',
  '{
    "integrations": {
      "funasrServiceUrl": "",
      "funasrApiPath": "/recognize",
      "funasrToken": "",
      "wechatAppId": "",
      "ssoEnabled": false,
      "ssoProvider": "企业微信 / OAuth"
    }
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO tasks(title, content, status, priority, start_at, end_at, created_by, updated_by)
SELECT
  '整理今天的客户回访事项',
  '优先联系 A 类客户，确认回访结果并补充备注。',
  'todo',
  'high',
  NOW(),
  NOW() + INTERVAL '1 hour',
  u.id,
  u.id
FROM users u
WHERE u.username = 'admin'
AND NOT EXISTS (SELECT 1 FROM tasks LIMIT 1);

INSERT INTO tasks(title, content, status, priority, start_at, end_at, created_by, updated_by)
SELECT
  '补充会议中的待办任务',
  '上传录音后通过 funASR 生成文本，再拆分为多条事务。',
  'in_progress',
  'medium',
  NOW() + INTERVAL '1 day',
  NOW() + INTERVAL '1 day 2 hours',
  u.id,
  u.id
FROM users u
WHERE u.username = 'demo'
AND (SELECT COUNT(*) FROM tasks) = 1;
