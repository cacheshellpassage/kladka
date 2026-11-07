/** Dev helper: `pnpm tsx src/dev/scaffold-report.ts <id...>` lists blocks that would need scaffolding. */
import { planBuild, roleFromCode } from "@kladka/voxel-core";
import { CATALOG, buildEntry } from "../catalog";
for (const id of process.argv.slice(2)) {
  const e = CATALOG.find((c) => c.id === id)!;
  const { model } = buildEntry(e);
  const plan = planBuild(model);
  const sc = plan.steps.filter((s) => s.scaffold).flatMap((s) => s.blocks);
  const counts = new Map<string, number>();
  for (const i of sc) {
    const k =
      model.palette[model.blocks[i]!]!.name.replace("minecraft:", "") +
      ":" +
      roleFromCode(plan.roles[i]!) +
      ":y" +
      model.coords(i).y;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  console.log(id, sc.length, [...counts].slice(0, 12));
}
