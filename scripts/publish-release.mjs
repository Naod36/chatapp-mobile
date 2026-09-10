#!/usr/bin/env node
// One-command release pipeline: builds a production Android APK via EAS,
// then registers it as the current release on the backend so the web app's
// download link and QR code (which poll /releases/latest) update automatically.
//
// Usage:
//   RELEASE_API_KEY=xxxxx npm run release:android -- --notes "Fixed crash on login"
//
// One-time setup:
//   1. cd chatapp-mobile && npx eas-cli login   (or set EXPO_TOKEN)
//   2. Set RELEASE_API_KEY to the same value configured on the Render backend
//      (both as a local env var here, and as a Render environment variable).

import { execFileSync } from "node:child_process";

const BACKEND_URL = process.env.RELEASE_BACKEND_URL || "https://chatapp-backend-chyk.onrender.com";
const RELEASE_API_KEY = process.env.RELEASE_API_KEY;

if (!RELEASE_API_KEY) {
    console.error(
        "Missing RELEASE_API_KEY environment variable.\n" +
        "Set it to the same secret configured as RELEASE_API_KEY on the Render backend, then re-run this script."
    );
    process.exit(1);
}

const notesIndex = process.argv.indexOf("--notes");
const releaseNotesArg = notesIndex !== -1 ? process.argv.slice(notesIndex + 1).join(" ") : undefined;

console.log("Building Android production APK via EAS (this can take several minutes)...");

let stdout;
try {
    stdout = execFileSync(
        "npx",
        ["eas", "build", "--platform", "android", "--profile", "production", "--non-interactive", "--json"],
        {
            stdio: ["inherit", "pipe", "inherit"],
            encoding: "utf8",
            maxBuffer: 1024 * 1024 * 20,
            shell: process.platform === "win32",
        }
    );
} catch (err) {
    console.error(
        "EAS build failed or is waiting on Expo authentication.\n" +
        "Run 'npx eas-cli login' once (interactively) if you have not authenticated this machine yet.\n" +
        String(err?.message || err)
    );
    process.exit(1);
}

let builds;
try {
    builds = JSON.parse(stdout);
} catch {
    console.error("Could not parse EAS build output as JSON:\n" + stdout);
    process.exit(1);
}

const build = Array.isArray(builds) ? builds[0] : builds;
const apkUrl = build?.artifacts?.buildUrl;

if (!build || build.status?.toUpperCase() !== "FINISHED" || !apkUrl) {
    console.error("Build did not complete successfully:\n" + JSON.stringify(build, null, 2));
    process.exit(1);
}

const version = build.appVersion || build.metadata?.appVersion || "0.0.0";
const buildNumber = Number(build.appBuildVersion || build.metadata?.appBuildVersion) || 1;
const releaseNotes = releaseNotesArg || `FlowChat v${version} (Build #${buildNumber})`;

console.log(`Build complete: v${version} (build ${buildNumber}) -> ${apkUrl}`);
console.log("Publishing release to backend...");

const response = await fetch(`${BACKEND_URL}/releases/publish`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "X-Release-Key": RELEASE_API_KEY,
    },
    body: JSON.stringify({
        platform: "android",
        version,
        build_number: buildNumber,
        apk_url: apkUrl,
        release_notes: releaseNotes,
    }),
});

if (!response.ok) {
    console.error(`Failed to publish release: ${response.status} ${await response.text()}`);
    process.exit(1);
}

const release = await response.json();
console.log(`\nRelease published: ${release.id}`);
console.log(`Download link: ${BACKEND_URL}/releases/${release.id}/download`);
console.log("The web app's download button and QR code now point to this release automatically.");
