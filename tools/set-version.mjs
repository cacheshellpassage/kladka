// usage: node tools/set-version.mjs <version> [--code <versionCode>]
// Writes the app version everywhere it lives, so a release never ships with mismatched numbers.
// The Android versionCode grows by one when the version changes, unless --code sets it.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [version, ...rest] = process.argv.slice(2);
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("usage: node tools/set-version.mjs <major.minor.patch> [--code <versionCode>]");
  process.exit(1);
}
const codeAt = rest.indexOf("--code");
const codeArg = codeAt >= 0 ? Number(rest[codeAt + 1]) : undefined;
if (codeArg !== undefined && (!Number.isInteger(codeArg) || codeArg < 1)) {
  console.error("--code takes a positive whole number");
  process.exit(1);
}

const edit = (file, fn) => {
  const path = join(root, file);
  const before = readFileSync(path, "utf8");
  const after = fn(before);
  if (after !== before) writeFileSync(path, after);
  console.log(`${after === before ? "same   " : "updated"} ${file}`);
};
const swap = (text, pattern, value, file) => {
  if (!pattern.test(text)) throw new Error(`${file}: no version line found`);
  return text.replace(pattern, (_, head, tail) => `${head}${value}${tail}`);
};

const jsonFiles = [
  "package.json",
  "apps/app/package.json",
  "apps/app/app.config.json",
  "apps/app/src-tauri/tauri.conf.json",
  "packages/content/package.json",
  "packages/renderer-cli/package.json",
  "packages/viewer/package.json",
  "packages/voxel-core/package.json",
];
for (const f of jsonFiles) edit(f, (s) => swap(s, /("version":\s*")[^"]+(")/, version, f));

edit("apps/app/src-tauri/Cargo.toml", (s) =>
  swap(s, /(\[package\][^[]*?\nversion = ")[^"]+(")/, version, "Cargo.toml"),
);

edit("apps/app/android/app/build.gradle", (s) => {
  const name = /(versionName ")[^"]+(")/.exec(s)?.[0];
  const current = Number(/versionCode (\d+)/.exec(s)?.[1]);
  if (!name || !current) throw new Error("build.gradle: versionName or versionCode not found");
  const changed = name !== `versionName "${version}"`;
  const code = codeArg ?? (changed ? current + 1 : current);
  console.log(`        versionName ${version}, versionCode ${code}`);
  return swap(s, /(versionName ")[^"]+(")/, version, "build.gradle").replace(
    /versionCode \d+/,
    `versionCode ${code}`,
  );
});
