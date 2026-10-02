import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function resolvePnpmCommand() {
  if (process.env.npm_execpath) {
    return {
      cmd: process.execPath,
      args: [process.env.npm_execpath, "dev"],
      shell: false,
    };
  }
  return {
    cmd: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    args: ["dev"],
    shell: process.platform === "win32",
  };
}

const { cmd: pnpmCmd, args: pnpmArgs, shell: useShell } = resolvePnpmCommand();

const api = spawn(pnpmCmd, pnpmArgs, {
  cwd: path.resolve(rootDir, "apps/api"),
  shell: useShell,
  stdio: "inherit",
  env: { ...process.env },
});

const web = spawn(pnpmCmd, pnpmArgs, {
  cwd: path.resolve(rootDir, "apps/web"),
  shell: useShell,
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
