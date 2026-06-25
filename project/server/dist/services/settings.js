import { config } from "../config.js";
import { query } from "../db.js";
const defaultSettings = () => ({
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
    const result = await query(`SELECT value FROM system_settings WHERE key = 'app' LIMIT 1`);
    return result.rows[0]?.value ?? defaultSettings();
};
export const saveSettings = async (settings) => {
    await query(`
      INSERT INTO system_settings(key, value, updated_at)
      VALUES ('app', $1::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [JSON.stringify(settings)]);
};
