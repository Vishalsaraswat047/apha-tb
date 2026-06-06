// auto-push-watcher.ts
// Runs in the background and watches the Apha TB project for any file changes.
// When a change is detected:
//   1. stages the change
//   2. creates an auto-commit with a timestamp
//   3. pushes to the configured GitHub remote
// Run: `npx tsx scripts/auto-push-watcher.ts`
// or:  `node scripts/auto-push-watcher.cjs` (after build)
//
// The token is read from:
//   1. GITHUB_TOKEN env var
//   2. the remote URL embedded in `git config remote.origin.url` (preferred for this project)
//
// To stop: Ctrl+C
//
// State debounce: changes are flushed 3 seconds after the last edit so we
// don't fire dozens of small commits when you're editing a single file.

import chokidar from "chokidar";
import { exec, execSync } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_DIR = process.env.PROJECT_DIR || path.resolve(__dirname, "..");
const DEBOUNCE_MS = 3000;
const IGNORE = [
  /node_modules/,
  /dist/,
  /build/,
  /\.state\//,
  /\.env$/,
  /\.git\//,
  /server\.log$/,
  /server_port\.json$/,
  /\.cora\//,
  /\.vscode\//,
  /nohup\.out$/,
  /state_persistence.*\.json$/,
];

let pending = false;
let timer: NodeJS.Timeout | null = null;
let isPushing = false;

function log(msg: string) {
  console.log(`[auto-push ${new Date().toISOString()}] ${msg}`);
}

function inIgnore(absPath: string): boolean {
  return IGNORE.some((re) => re.test(absPath));
}

function flush() {
  if (isPushing) {
    log("already pushing; will retry on next change");
    return;
  }
  if (!pending) return;
  pending = false;
  isPushing = true;
  log("flushing commit + push...");

  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const cmd = `git add -A && git commit -m "auto: live edits ${ts}" --allow-empty && git push origin main`;

  exec(cmd, { cwd: PROJECT_DIR, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
    isPushing = false;
    if (err) {
      // Common non-fatal: nothing to commit
      const combined = `${stdout}\n${stderr}`;
      if (/nothing to commit/i.test(combined)) {
        log("nothing to commit");
      } else {
        log(`PUSH ERROR: ${err.message}`);
        log(combined.split("\n").slice(0, 8).join("\n"));
      }
    } else {
      const out = `${stdout}`.trim().split("\n").slice(-4).join(" | ");
      log(`pushed: ${out}`);
    }
  });
}

function schedule() {
  pending = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

function main() {
  log(`watching ${PROJECT_DIR}`);
  log(`debounce ${DEBOUNCE_MS}ms`);

  // Verify the remote and token
  try {
    const remotes = execSync("git remote -v", { cwd: PROJECT_DIR, encoding: "utf8" });
    log(`remotes:\n${remotes.trim()}`);
    if (!/origin\s+https:\/\/[^\s]*github\.com[^\s]*/.test(remotes)) {
      log("WARNING: no github origin configured");
    }
  } catch (e: any) {
    log(`git remote check failed: ${e.message}`);
  }

  const watcher = chokidar.watch(PROJECT_DIR, {
    ignored: (p: string) => inIgnore(p),
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });

  const onChange = (p: string) => {
    if (inIgnore(p)) return;
    log(`changed: ${path.relative(PROJECT_DIR, p) || p}`);
    schedule();
  };

  watcher.on("add", onChange);
  watcher.on("change", onChange);
  watcher.on("unlink", onChange);
  watcher.on("unlinkDir", onChange);
  watcher.on("error", (e) => log(`watcher error: ${e.message}`));
  watcher.on("ready", () => log("watcher ready - edits will auto-commit and push"));

  // Graceful shutdown
  process.on("SIGINT", () => {
    log("shutting down (SIGINT)...");
    watcher.close();
    if (pending) flush();
    setTimeout(() => process.exit(0), 1000);
  });
  process.on("SIGTERM", () => {
    log("shutting down (SIGTERM)...");
    watcher.close();
    if (pending) flush();
    setTimeout(() => process.exit(0), 1000);
  });
}

main();
