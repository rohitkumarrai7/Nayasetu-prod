#!/usr/bin/env node
// One-time Convex Auth key setup (fixes "Missing environment variable JWT_PRIVATE_KEY" on sign-up).
// Generates an RS256 key pair and sets JWT_PRIVATE_KEY + JWKS (+ SITE_URL) on your Convex deployment.
//
//   node scripts/setup-auth.mjs                         # dev deployment
//   node scripts/setup-auth.mjs --prod                  # production deployment
//   node scripts/setup-auth.mjs --prod --site https://nayasetu-prod.vercel.app
//   node scripts/setup-auth.mjs --print                 # just print the values
//
// Equivalent to `npx @convex-dev/auth`, but non-interactive (works in CI / headless shells).
// Re-running ROTATES the keys, which signs everyone out — run it once per deployment.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const print = args.includes("--print");
const siteIdx = args.indexOf("--site");
const site = siteIdx >= 0 ? args[siteIdx + 1] : prod ? "https://nayasetu-prod.vercel.app" : "http://localhost:3000";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, " ");
const jwks = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(keys.publicKey)) }] });

if (print) {
  console.log(`JWT_PRIVATE_KEY="${privateKey}"`);
  console.log(`JWKS=${jwks}`);
  console.log(`SITE_URL=${site}`);
  process.exit(0);
}

// Run the local Convex CLI through node itself: `npx` is `npx.cmd` on Windows, which cannot be
// spawned without a shell (and a shell would mangle the multi-line key).
const convexCli = fileURLToPath(new URL("../node_modules/convex/bin/main.js", import.meta.url));
const set = (name, value) => {
  const cmd = [convexCli, "env", "set", ...(prod ? ["--prod"] : []), "--", name, value];
  execFileSync(process.execPath, cmd, { stdio: ["ignore", "inherit", "inherit"] });
};
set("JWT_PRIVATE_KEY", privateKey);
set("JWKS", jwks);
set("SITE_URL", site);
console.log(`\nConvex Auth configured for the ${prod ? "PRODUCTION" : "dev"} deployment (SITE_URL=${site}).`);
