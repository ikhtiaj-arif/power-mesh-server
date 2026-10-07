/**
 * Render (and similar hosts) sometimes keep a stale node_modules cache from
 * before `stripe` was added. Fail clearly, then install the prod dependency
 * so `tsup` / runtime can resolve it.
 */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);

function hasStripe() {
  try {
    require.resolve("stripe");
    return true;
  } catch {
    return false;
  }
}

if (hasStripe()) {
  console.log("stripe: ok");
  process.exit(0);
}

console.warn("stripe missing from node_modules — installing production dependency…");
const result = spawnSync(
  "npm",
  ["install", "stripe@23.0.0", "--no-save", "--no-fund", "--no-audit"],
  { stdio: "inherit", shell: true },
);

if (result.status !== 0 || !hasStripe()) {
  console.error(
    "Failed to install stripe. On Render: clear build cache, set NODE_VERSION=20, then redeploy.",
  );
  process.exit(1);
}

console.log("stripe: installed");
