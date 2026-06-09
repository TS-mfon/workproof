// Refuses to pass if any source file outside the approved oracle signer
// contains a path that can sign `verify_submission`/`verify_work`.
// The only approved signing site is `frontend/lib/oracle/genlayer.ts`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = resolve(__dirname, "..");

const ALLOWED = new Set<string>([
  // The single legitimate writeContract verify_submission site:
  "frontend/lib/oracle/genlayer.ts",
  // The grep gate itself, which contains the regex literals it scans for:
  "scripts/check-no-non-oracle-genlayer.ts"
]);

const BAD_PATTERNS: RegExp[] = [
  /functionName\s*:\s*['"]verify_submission['"]/, // direct writeContract verify_submission
  /functionName\s*:\s*['"]verify_work['"]/,        // direct writeContract verify_work
  /['"]write['"]\s*,\s*verifier/,                  // genlayer ["write", verifier, ...]
  /['"]write['"]\s*,\s*[A-Za-z_]\w*Contract\b/,   // genlayer ["write", someContract, ...]
  /\bverify_work['"]\s*,\s*['"]?--args/             // CLI verify_work form
];

function listFiles(): string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "--", "*.ts", "*.tsx", "*.js"],
    { encoding: "utf8", cwd: ROOT }
  );
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => !p.startsWith("node_modules/"))
    .filter((p) => !p.endsWith(".d.ts"));
}

function main() {
  const offenders: Array<{ file: string; line: number; match: string }> = [];
  for (const rel of listFiles()) {
    if (ALLOWED.has(rel)) continue;
    let body: string;
    try { body = readFileSync(resolve(ROOT, rel), "utf8"); }
    catch { continue; }
    const lines = body.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // skip comments / commented-out fragments to reduce false positives
      if (/^\s*(\/\/|\*|#)/.test(line)) continue;
      for (const pat of BAD_PATTERNS) {
        if (pat.test(line)) {
          offenders.push({ file: rel, line: i + 1, match: line.trim() });
        }
      }
    }
  }
  if (offenders.length === 0) {
    console.log("ok: no non-oracle GenLayer signing paths found");
    return;
  }
  console.error("FAIL: non-oracle GenLayer signing paths detected:");
  for (const o of offenders) {
    console.error(`  ${o.file}:${o.line}  ${o.match}`);
  }
  console.error("");
  console.error("All `verify_submission` writes must go through /api/genlayer-trigger");
  console.error("(which signs with ORACLE_PRIVATE_KEY in frontend/lib/oracle/genlayer.ts).");
  process.exit(1);
}

main();
