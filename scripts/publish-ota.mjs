#!/usr/bin/env node
// Bumps the in-app OTA counter (src/config/otaVersion.json) and publishes the
// update in one step, so the counter shown in Account settings always matches
// what was actually shipped instead of relying on a manually edited file.
//
// Usage: npm run ota:publish -- --message "What changed"

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(
  __dirname,
  "..",
  "src",
  "config",
  "otaVersion.json",
);
const easEntry = createRequire(import.meta.url).resolve("eas-cli/bin/run");

const config = JSON.parse(readFileSync(configPath, "utf8"));
config.otaNumber = (config.otaNumber || 0) + 1;
config.lastUpdated = new Date().toISOString().slice(0, 10);
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log(
  `Bumped OTA counter to #${config.otaNumber} (${config.lastUpdated})`,
);

const messageIndex = process.argv.indexOf("--message");
const message =
  messageIndex !== -1
    ? process.argv.slice(messageIndex + 1).join(" ")
    : `OTA #${config.otaNumber}`;

console.log("Publishing update via EAS...");

try {
  execFileSync(
    process.execPath,
    [
      easEntry,
      "update",
      "--branch",
      "production",
      "--non-interactive",
      "--message",
      message,
    ],
    { stdio: "inherit" },
  );
} catch (err) {
  console.error("eas update failed:", err?.message || err);
  process.exit(1);
}
