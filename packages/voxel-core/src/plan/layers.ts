/** Data for 2D layer schematics (top-down grid with coordinates). */
import type { VoxelModel } from "../model/model";
import type { BuildPlan } from "./planner";

export interface LayerGrid {
  y: number;
  width: number;
  depth: number;
  /** Palette index per cell (x + z*width), 0 = empty. */
  cells: Uint16Array;
  /** Global step per cell, -1 = empty. */
  steps: Int32Array;
  /** Palette index of the layer below (for ghosting), 0 = empty. */
  below: Uint16Array;
}

export function layerGrid(m: VoxelModel, plan: BuildPlan | null, y: number): LayerGrid {
  const { x: sx, z: sz } = m.size;
  const cells = new Uint16Array(sx * sz);
  const steps = new Int32Array(sx * sz).fill(-1);
  const below = new Uint16Array(sx * sz);
  for (let z = 0; z < sz; z++)
    for (let x = 0; x < sx; x++) {
      const c = x + z * sx;
      if (y >= 0 && y < m.size.y) {
        const i = m.index(x, y, z);
        cells[c] = m.blocks[i]!;
        if (plan) steps[c] = plan.stepOf[i]!;
      }
      if (y - 1 >= 0 && y - 1 < m.size.y) below[c] = m.blocks[m.index(x, y - 1, z)]!;
    }
  return { y, width: sx, depth: sz, cells, steps, below };
}

/** Palette indices present in a layer with counts (legend of the 2D plan). */
export function layerLegend(grid: LayerGrid): Array<{ palette: number; count: number }> {
  const counts = new Map<number, number>();
  for (const p of grid.cells) if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts].map(([palette, count]) => ({ palette, count })).sort((a, b) => b.count - a.count);
}
