/**
 * Difficulty (1..5) and time estimate for a planned build.
 * Time model: ~1.6 s per block placed by hand + 20 s per step for orientation and fetching
 * materials; special shapes (stairs, doors, torches…) take longer. Values are rounded to 5 minutes.
 */
import { blockInfo } from "../games/minecraft-java/blocks";
import type { VoxelModel } from "../model/model";
import type { BuildPlan } from "./planner";

export interface Estimate {
  difficulty: 1 | 2 | 3 | 4 | 5;
  minutes: number;
  specialShare: number;
  distinctMaterials: number;
}

export function estimate(m: VoxelModel, plan: BuildPlan, distinctMaterials: number): Estimate {
  let special = 0;
  for (const { p } of m.nonAir()) {
    const s = blockInfo(m.palette[p]!.name).shape;
    if (s !== "cube" && s !== "slab") special++;
  }
  const blocks = Math.max(1, plan.totalBlocks);
  const specialShare = special / blocks;
  const seconds = blocks * 1.6 + special * 1.2 + plan.steps.length * 20;
  const minutes = Math.max(5, Math.round(seconds / 60 / 5) * 5);
  const height = m.size.y;
  let score = 0;
  score += Math.log10(blocks) * 1.2; // 100 → 2.4, 1000 → 3.6, 10000 → 4.8
  score += Math.min(1.2, distinctMaterials / 20);
  score += specialShare * 1.5;
  score += height > 20 ? 0.6 : height > 12 ? 0.3 : 0;
  const difficulty = Math.min(5, Math.max(1, Math.round(score - 1.6))) as Estimate["difficulty"];
  return { difficulty, minutes, specialShare, distinctMaterials };
}
