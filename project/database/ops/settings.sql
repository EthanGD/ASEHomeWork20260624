SELECT key, value, updated_at
FROM system_settings
WHERE key = 'app'
LIMIT 1;

INSERT INTO system_settings(key, value, updated_at)
VALUES ('app', $1::jsonb, NOW())
ON CONFLICT (key)
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
