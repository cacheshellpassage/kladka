#!/usr/bin/env node
/**
 * Offline guard: scans the built web bundle (apps/app/dist) for references to remote origins that the
 * app could load at runtime (fetch/XHR/import/src/href). Known harmless strings (license texts, XML
 * namespaces, documentation links that are never fetched) are allowed explicitly.
 * Usage: node tools/check-offline.mjs [distDir]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = process.argv[2] ?? join(root, "apps/app/dist");

// URLs that may appear as plain strings but are never requested by the app.
const ALLOW = [
  /^http:\/\/www\.w3\.org\//, // SVG / XHTML namespaces
  /^https?:\/\/(www\.)?(reactjs\.org|react\.dev)\/(docs\/error-decoder|link\/|errors)/, // React error messages
  /^https?:\/\/(github\.com|bit\.ly|goo\.gl)\//, // comments / error hints inside libraries
  /^https?:\/\/(developer\.mozilla\.org|developers\.google\.com|web\.dev|capacitorjs\.com|ionicframework\.com|tauri\.app|v2\.tauri\.app)\//,
  /^https?:\/\/(creativecommons\.org|opensource\.org|spdx\.org)\//,
  /^https?:\/\/(localhost|127\.0\.0\.1|ipc\.localhost|asset\.localhost|tauri\.localhost)/, // native shells
  /^https:\/\/threejs\.org\//, // three.js warnings
  /^https?:\/\/fb\.me\//,
];

const URL_RE = /\bhttps?:\/\/[A-Za-z0-9.\-_~:/?#[\]@!$&'()*+,;=%]+/g;
const TEXT_EXT = new Set([".js", ".mjs", ".css", ".html", ".json", ".webmanifest", ".txt"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const offenders = new Map();
for (const file of walk(dist)) {
  if (!TEXT_EXT.has(extname(file))) continue;
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[),;'"]+$/, "");
    if (ALLOW.some((re) => re.test(url))) continue;
    const list = offenders.get(url) ?? new Set();
    list.add(file.slice(dist.length + 1));
    offenders.set(url, list);
  }
}

if (offenders.size) {
  console.error("Remote URLs found in the bundle (the app must work offline):");
  for (const [url, files] of offenders) console.error(`  ${url}  <-  ${[...files].join(", ")}`);
  process.exit(1);
}
console.log(`OK: no remote URLs in ${dist}`);
