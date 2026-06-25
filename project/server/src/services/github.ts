import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { query } from "../db.js";

export type GithubFlowState =
  | {
      provider: "github";
      action: "bind";
      userId: number;
    }
  | {
      provider: "github";
      action: "login";
    };

export const signGithubState = (payload: GithubFlowState) =>
  jwt.sign(payload, config.jwtSecret, { expiresIn: "10m" });

export const parseGithubState = (state?: string | null): GithubFlowState | null => {
  if (!state) {
    return null;
  }

  try {
    const parsed = jwt.verify(state, config.jwtSecret) as GithubFlowState;
    if (parsed.provider !== "github") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const buildGithubBindRedirect = (success: boolean, message?: string) => {
  const url = new URL(config.clientUrl);
  url.searchParams.set("account", "github");
  url.searchParams.set("bind", success ? "success" : "error");
  if (message) {
    url.searchParams.set("message", message);
  }
  return url.toString();
};

export const buildGithubLoginRedirect = (token?: string, error?: string) => {
  const url = new URL(config.clientUrl);
  if (token) {
    url.searchParams.set("token", token);
    url.searchParams.set("auth", "github");
  }
  if (error) {
    url.searchParams.set("auth", "github");
    url.searchParams.set("error", error);
  }
  return url.toString();
};

export const buildGithubAuthUrl = (state: string) => {
  if (!config.github.clientId) {
    return {
      mode: "mock" as const,
      url: `${config.serverPublicUrl}/api/auth/github/mock-callback?state=${encodeURIComponent(state)}`
    };
  }

  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.redirectUri,
    state,
    scope: "read:user user:email"
  });
  return {
    mode: "real" as const,
    url: `https://github.com/login/oauth/authorize?${params.toString()}`
  };
};

export const getMockGithubProfile = (state: GithubFlowState | null) => {
  if (state?.action === "bind") {
    return {
      id: `${config.github.mock.id}-bind-${state.userId}`,
      login: `${config.github.mock.login}-${state.userId}`,
      email: null as string | null
    };
  }

  return {
    id: config.github.mock.id,
    login: config.github.mock.login,
    email: null as string | null
  };
};

export const exchangeGithubCode = async (code: string) => {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: config.github.clientId,
      client_secret: config.github.clientSecret,
      code,
      redirect_uri: config.github.redirectUri
    })
  });

  const payload = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? "GitHub access token 获取失败");
  }

  return payload.access_token;
};

export const fetchGithubUser = async (accessToken: string) => {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "voice-task-server"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub 用户信息获取失败，状态码 ${response.status}`);
  }

  const payload = (await response.json()) as {
    id?: number;
    login?: string;
    email?: string | null;
  };

  if (!payload.id || !payload.login) {
    throw new Error("GitHub 用户信息不完整");
  }

  return {
    id: String(payload.id),
    login: payload.login,
    email: payload.email ?? null
  };
};

export const bindGithubToUser = async ({
  userId,
  githubId,
  githubLogin,
  githubEmail
}: {
  userId: number;
  githubId: string;
  githubLogin: string;
  githubEmail: string | null;
}) => {
  const existing = await query<{ user_id: number }>(
    `
      SELECT user_id
      FROM oauth_identities
      WHERE provider = 'github' AND provider_user_id = $1
      LIMIT 1
    `,
    [githubId]
  );

  if (existing.rows[0] && existing.rows[0].user_id !== userId) {
    throw new Error("该 GitHub 账号已绑定其他账号");
  }

  await query(
    `
      INSERT INTO oauth_identities(
        user_id,
        provider,
        provider_user_id,
        provider_username,
        provider_email,
        raw_profile,
        updated_at
      )
      VALUES ($1, 'github', $2, $3, $4, $5::jsonb, NOW())
      ON CONFLICT (user_id, provider)
      DO UPDATE SET
        provider_user_id = EXCLUDED.provider_user_id,
        provider_username = EXCLUDED.provider_username,
        provider_email = EXCLUDED.provider_email,
        raw_profile = EXCLUDED.raw_profile,
        updated_at = NOW()
    `,
    [userId, githubId, githubLogin, githubEmail, JSON.stringify({ id: githubId, login: githubLogin, email: githubEmail })]
  );
};

export const unbindGithubFromUser = async (userId: number) => {
  await query(
    `
      DELETE FROM oauth_identities
      WHERE user_id = $1 AND provider = 'github'
    `,
    [userId]
  );
};

export const fetchGithubIdentityUserId = async (githubId: string) => {
  const result = await query<{ user_id: number }>(
    `
      SELECT user_id
      FROM oauth_identities
      WHERE provider = 'github' AND provider_user_id = $1
      LIMIT 1
    `,
    [githubId]
  );

  return result.rows[0]?.user_id ?? null;
};

export const fetchUserIdentities = async (userId: number) => {
  const result = await query<{
    provider: string;
    provider_user_id: string;
    provider_username: string | null;
    provider_email: string | null;
    updated_at: string;
  }>(
    `
      SELECT provider, provider_user_id, provider_username, provider_email, updated_at
      FROM oauth_identities
      WHERE user_id = $1
      ORDER BY provider
    `,
    [userId]
  );
  return result.rows;
};
