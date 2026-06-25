import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const proxyConfigPath = path.resolve(__dirname, "proxy.conf.json");
const proxy = fs.existsSync(proxyConfigPath)
  ? JSON.parse(fs.readFileSync(proxyConfigPath, "utf8"))
  : {};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy
  }
});
