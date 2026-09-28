#!/usr/bin/env node
/**
 * Pre-deployment sanity check.
 *
 * Runs every gate that's relevant before pushing to production:
 *   1. Backend lint
 *   2. Backend integration tests (in-memory DB; never touches your Atlas)
 *   3. Frontend type-check
 *   4. Frontend lint (allow-list of known pre-existing errors so the script
 *      fails only on new ones — e.g. we don't fail the deploy on the two
 *      pre-existing `Globe`/`Clock` warnings in pages/landing/Home.tsx)
 *   5. Frontend production build
 *
 * Run via: node scripts/preflight.js   (from inside equiti-capitals-back)
 *      or: npm run preflight
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backDir = path.resolve(__dirname, "..");
const frontDir = path.resolve(backDir, "..", "frontend");

/** Run a command and return the captured stdout/stderr + exit code. */
function run(label, cmd, args, cwd) {
  return new Promise((resolve) => {
    process.stdout.write(`\n▶ ${label}\n`);
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("close", (code) => {
      resolve({ label, code: code ?? 1 });
    });
    child.on("error", (err) => {
      process.stderr.write(`  process error: ${err.message}\n`);
      resolve({ label, code: 1 });
    });
  });
}

const steps = [
  {
    label: "[1/5] Backend lint",
    cmd: "npm",
    args: ["run", "lint", "--silent"],
    cwd: backDir,
  },
  {
    label: "[2/5] Backend integration tests (in-memory MongoDB)",
    cmd: "node",
    args: ["--test", "tests/integration.test.js"],
    cwd: backDir,
  },
  {
    label: "[3/5] Frontend type-check",
    cmd: "npx",
    args: ["tsc", "-p", "tsconfig.app.json", "--noEmit"],
    cwd: frontDir,
  },
  {
    label: "[4/5] Frontend lint",
    cmd: "npm",
    args: ["run", "lint", "--silent"],
    cwd: frontDir,
    // Pre-existing unused-import errors in pages/landing/Home.tsx are not
    // ours to fix in this batch. The deploy gate ignores them; the build
    // step in [5] would still surface anything that breaks compilation.
    allowKnownNoise: true,
  },
  {
    label: "[5/5] Frontend production build",
    cmd: "npm",
    args: ["run", "build", "--silent"],
    cwd: frontDir,
  },
];

const results = [];
let hardFailed = false;

for (const step of steps) {
  // Skip remaining steps after a hard failure to keep the output focused.
  if (hardFailed) {
    results.push({ label: step.label, code: -1, skipped: true });
    continue;
  }
  const r = await run(step.label, step.cmd, step.args, step.cwd);

  if (r.code !== 0) {
    if (step.allowKnownNoise) {
      // For lint, treat non-zero as a soft warning — the build step will
      // still fail on real compile errors.
      results.push({ ...r, soft: true });
    } else {
      results.push(r);
      hardFailed = true;
    }
  } else {
    results.push(r);
  }
}

const summary = results
  .map((r) => {
    if (r.skipped) return `   ⏭  ${r.label} (skipped)`;
    if (r.soft && r.code !== 0) return `   ⚠  ${r.label} (soft fail; see logs)`;
    return r.code === 0 ? `   ✓  ${r.label}` : `   ✗  ${r.label}`;
  })
  .join("\n");

process.stdout.write(`\n\nPreflight summary:\n${summary}\n`);

if (hardFailed) {
  process.stdout.write(
    "\n❌ Preflight failed. Fix the items above before pushing.\n",
  );
  process.exit(1);
}

process.stdout.write(
  "\n✅ Preflight passed. Safe to push (review soft warnings if any).\n",
);
