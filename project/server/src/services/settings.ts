import { config } from "../config.js";
import { query } from "../db.js";

export interface AppSettings {
  integrations: {
    funasrServiceUrl: string;
    funasrApiPath: string;
    funasrToken: string;
    wechatAppId: string;
    ssoEnabled: boolean;
    ssoProvider: string;
  };
}

type SettingsRow = {
  value: AppSettings;
};

const defaultSettings = (): AppSettings => ({
  integrations: {
    funasrServiceUrl: "",
    funasrApiPath: "/recognize",
    funasrToken: "",
    wechatAppId: config.wechat.appId,
    ssoEnabled: false,
    ssoProvider: "企业微信 / OAuth"
  }
});

export const normalizeSettings = async () => {
  const result = await query<SettingsRow>(
    `SELECT value FROM system_settings WHERE key = 'app' LIMIT 1`
  );

  return result.rows[0]?.value ?? defaultSettings();
};

export const saveSettings = async (settings: AppSettings) => {
  await query(
    `
      INSERT INTO system_settings(key, value, updated_at)
      VALUES ('app', $1::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [JSON.stringify(settings)]
  );
};
