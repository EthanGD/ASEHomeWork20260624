INSERT INTO tasks(title, content, status, priority, start_at, end_at, created_by, updated_by)
VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $7)
RETURNING id;

SELECT
  t.id,
  t.title,
  t.content,
  t.status,
  t.priority,
  t.start_at,
  t.end_at,
  t.created_by,
  t.updated_by,
  t.created_at,
  t.updated_at
FROM tasks t
WHERE t.id = $1;

UPDATE tasks
SET
  title = $2,
  content = $3,
  status = $4,
  priority = $5,
  start_at = $6::timestamptz,
  end_at = $7::timestamptz,
  updated_by = $8,
  updated_at = NOW()
WHERE id = $1;

DELETE FROM tasks WHERE id = $1;
