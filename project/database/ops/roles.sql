SELECT
  r.id,
  r.name,
  r.description,
  r.permission_keys,
  r.is_system,
  r.disabled,
  r.created_at
FROM roles r
ORDER BY r.is_system DESC, r.created_at ASC;

INSERT INTO roles(name, description, permission_keys, is_system)
VALUES ($1, $2, $3::text[], FALSE)
RETURNING id;

UPDATE roles
SET name = $2,
    description = $3,
    permission_keys = $4::text[]
WHERE id = $1;

UPDATE roles
SET disabled = $2
WHERE id = $1;

DELETE FROM roles WHERE id = $1;
