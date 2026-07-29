import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const api = spawn("pnpm", ["dev"], {
  cwd: path.resolve(rootDir, "apps/api"),
  shell: true,
  stdio: "inherit",
  env: { ...process.env },
});

const web = spawn("pnpm", ["dev"], {
  cwd: path.resolve(rootDir, "apps/web"),
  shell: true,
  stdio: "inherit",
  env: { ...process.env },
});

function shutdown() {
  try { api.kill(); } catch {}
  try { web.kill(); } catch {}
  process.exit();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", shutdown);
