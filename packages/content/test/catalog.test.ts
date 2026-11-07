import { describe, expect, it } from "vitest";
import { blockInfo, decodeKBuild, materialList, planBuild, roleFromCode } from "@kladka/voxel-core";
import { CATALOG, buildEntry } from "../src/catalog";
import { buildOne } from "../src/pack";

describe("built-in catalogue", () => {
  it("has at least 30 builds with unique ids and bilingual metadata", () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(30);
    const ids = new Set(CATALOG.map((e) => e.id));
    expect(ids.size).toBe(CATALOG.length);
    for (const e of CATALOG) {
      expect(e.title.ru.length).toBeGreaterThan(2);
      expect(e.title.en.length).toBeGreaterThan(2);
      expect(e.description.ru.length).toBeGreaterThan(10);
      expect(e.description.en.length).toBeGreaterThan(10);
      expect(e.title.en.toLowerCase()).not.toContain("minecraft");
    }
  });

  it("covers several styles", () => {
    const styles = new Set(CATALOG.map((e) => e.style));
    expect(styles.size).toBeGreaterThanOrEqual(7);
  });

  for (const e of CATALOG) {
    it(`${e.id}: generates a sane, buildable model`, () => {
      const { model, meta } = buildEntry(e);
      expect(meta.license).toBe("CC0-1.0");
      expect(model.size.x).toBeLessThanOrEqual(100);
      expect(model.size.y).toBeLessThanOrEqual(100);
      expect(model.size.z).toBeLessThanOrEqual(100);
      const blocks = model.countBlocks();
      expect(blocks).toBeGreaterThan(50);
      // only vanilla ids, all known to our block table
      for (const p of model.palette.slice(1)) {
        expect(p.name.startsWith("minecraft:")).toBe(true);
        expect(blockInfo(p.name).shape).not.toBe("air");
      }
      const plan = planBuild(model);
      expect(plan.totalBlocks).toBe(blocks);
      // explicit roles from the generator are used for every block
      for (let i = 0; i < model.volume; i++) {
        if (model.blocks[i] !== 0) expect(roleFromCode(model.roles?.[i] ?? 0)).not.toBeNull();
      }
      // almost everything must be placeable without scaffolding
      const scaffold = plan.steps.filter((s) => s.scaffold).reduce((n, s) => n + s.blocks.length, 0);
      expect(scaffold / blocks).toBeLessThan(0.02);
      expect(materialList(model).length).toBeGreaterThan(3);
    });
  }

  it("is deterministic and round-trips through .kbuild", () => {
    const e = CATALOG[1]!;
    const a = buildOne(e);
    const b = buildOne(e);
    expect(Array.from(a.bytes)).toEqual(Array.from(b.bytes));
    const back = decodeKBuild(a.bytes);
    expect(back.meta.id).toBe(e.id);
    expect(back.model.countBlocks()).toBe(a.entry.stats!.blocks);
  });
});
