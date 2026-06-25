SELECT
  id,
  user_id,
  provider,
  provider_user_id,
  provider_username,
  provider_email,
  raw_profile,
  created_at,
  updated_at
FROM oauth_identities
WHERE user_id = $1
ORDER BY provider;

INSERT INTO oauth_identities(
  user_id,
  provider,
  provider_user_id,
  provider_username,
  provider_email,
  raw_profile,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
ON CONFLICT (user_id, provider)
DO UPDATE SET
  provider_user_id = EXCLUDED.provider_user_id,
  provider_username = EXCLUDED.provider_username,
  provider_email = EXCLUDED.provider_email,
  raw_profile = EXCLUDED.raw_profile,
  updated_at = NOW();

DELETE FROM oauth_identities
WHERE user_id = $1 AND provider = $2;

