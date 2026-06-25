import { createApp } from "./app.js";
import { config } from "./config.js";
import { dbConnectionLabel } from "./db.js";
import { ensureDatabase } from "./init.js";
const start = async () => {
    await ensureDatabase();
    const app = createApp();
    app.listen(config.port, () => {
        console.log(`server ready at ${config.serverPublicUrl}`);
        console.log(`database target ${dbConnectionLabel}`);
        console.log(`github oauth clientId ${config.github.clientId || "(empty)"}`);
        console.log(`github oauth redirectUri ${config.github.redirectUri}`);
        if (config.github.redirectUri && !config.github.redirectUri.startsWith(config.serverPublicUrl)) {
            console.warn(`github redirectUri does not start with serverPublicUrl, check .env: ${config.github.redirectUri}`);
        }
    });
};
start().catch((error) => {
    console.error("server start failed", error);
    process.exit(1);
});
