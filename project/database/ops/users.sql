SELECT
  u.id,
  u.username,
  u.display_name,
  u.email,
  u.status,
  u.auth_source,
  u.wechat_open_id,
  (u.wechat_open_id IS NOT NULL) AS wechat_bound,
  u.deleted,
  u.created_at,
  u.updated_at
FROM users u
WHERE u.deleted = FALSE
ORDER BY u.created_at DESC;

INSERT INTO users(username, password_hash, display_name, email, status, auth_source)
VALUES ($1, $2, $3, $4, $5, 'local')
RETURNING id;

UPDATE users
SET
  username = $2,
  display_name = $3,
  email = $4,
  status = $5,
  updated_at = NOW()
WHERE id = $1;

UPDATE users
SET password_hash = $2,
    updated_at = NOW()
WHERE id = $1;

UPDATE users
SET deleted = TRUE,
    updated_at = NOW()
WHERE id = $1;

UPDATE users
SET wechat_open_id = $2,
    updated_at = NOW()
WHERE id = $1;

UPDATE users
SET wechat_open_id = NULL,
    updated_at = NOW()
WHERE id = $1;
