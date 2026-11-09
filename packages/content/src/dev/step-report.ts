/**
 * Dev report: step counts per catalog build (total, single-block steps, pillar steps) compared with
 * the numbers stored in the current pack.json.  `pnpm --filter @kladka/content exec tsx src/dev/step-report.ts`
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { planBuild } from "@kladka/voxel-core";
import { CATALOG, buildEntry } from "../catalog";

const here = dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(
  readFileSync(join(here, "../../../../apps/app/public/packs/core/pack.json"), "utf8"),
) as { builds: Array<{ id: string; stats: { steps: number } }> };
const before = new Map(pack.builds.map((b) => [b.id, b.stats.steps]));

let sumBefore = 0,
  sumAfter = 0;
for (const e of CATALOG) {
  const { model: m } = buildEntry(e);
  const plan = planBuild(m);
  const singles = plan.steps.filter((s) => s.blocks.length === 1).length;
  const pillars = plan.steps.filter((s) => s.layerTo !== undefined).length;
  const b = before.get(e.id) ?? 0;
  sumBefore += b;
  sumAfter += plan.steps.length;
  console.log(
    `${e.id.padEnd(18)} steps ${String(b).padStart(4)} → ${String(plan.steps.length).padStart(4)}   1-block ${String(singles).padStart(3)}   pillars ${pillars}`,
  );
}
console.log(`total steps ${sumBefore} → ${sumAfter}`);
