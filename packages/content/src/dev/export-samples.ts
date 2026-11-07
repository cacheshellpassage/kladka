#!/usr/bin/env node
/**
 * Exports every built-in build to .litematic, .schem (v3 and v2) and .nbt into a folder, e.g. for the optional
 * Python cross-check (tools/crosscheck_litemapy.py) or for testing in the game.
 * Usage: pnpm --filter @kladka/content exec tsx src/dev/export-samples.ts <outDir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { exportModel, type ExportFormat } from "@kladka/voxel-core";
import { CATALOG, buildEntry } from "../catalog";

const out = resolve(process.argv[2] ?? "exports");
mkdirSync(out, { recursive: true });
for (const e of CATALOG) {
  const { model } = buildEntry(e);
  for (const fmt of ["litematic", "schem", "schem-v2", "nbt"] as ExportFormat[]) {
    const r = exportModel(model, fmt);
    const suffix = fmt === "schem-v2" ? "-v2" : "";
    writeFileSync(join(out, `${e.id}${suffix}.${r.extension}`), r.bytes);
  }
}
console.log(`Exported ${CATALOG.length} builds × 4 formats to ${out}`);
