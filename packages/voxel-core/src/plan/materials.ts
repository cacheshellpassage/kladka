/** Material lists: pieces, stacks of 64 (or 16/1) and shulker boxes of 27 stacks. */
import { gameAdapter } from "../games";
import type { VoxelModel } from "../model/model";

export interface MaterialLine {
  item: string;
  count: number;
  stackSize: number;
  /** Full stacks. */
  stacks: number;
  /** Items left after full stacks. */
  remainder: number;
  /** Shulker boxes needed (fractional, 27 stacks each). */
  shulkers: number;
}

export function countItems(m: VoxelModel, voxels: Iterable<number>): Map<string, number> {
  const game = gameAdapter(m.game);
  const perPalette = new Map<number, number>();
  for (const i of voxels) {
    const p = m.blocks[i]!;
    if (p === 0) continue;
    perPalette.set(p, (perPalette.get(p) ?? 0) + 1);
  }
  const items = new Map<string, number>();
  for (const [p, n] of perPalette) {
    for (const it of game.itemsFor(m.palette[p]!)) items.set(it.item, (items.get(it.item) ?? 0) + it.count * n);
  }
  return items;
}

export function toLines(m: VoxelModel, items: Map<string, number>): MaterialLine[] {
  const game = gameAdapter(m.game);
  const lines: MaterialLine[] = [];
  for (const [item, count] of items) {
    const stackSize = game.stackSize(item);
    lines.push({
      item,
      count,
      stackSize,
      stacks: Math.floor(count / stackSize),
      remainder: count % stackSize,
      shulkers: count / (27 * stackSize),
    });
  }
  lines.sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
  return lines;
}

export function materialList(m: VoxelModel, voxels?: Iterable<number>): MaterialLine[] {
  const all = voxels ?? allBlocks(m);
  return toLines(m, countItems(m, all));
}

function* allBlocks(m: VoxelModel): Generator<number> {
  for (let i = 0; i < m.blocks.length; i++) if (m.blocks[i] !== 0) yield i;
}

/** "3 ст. + 12" style breakdown; returns structured data so UI can localise. */
export function stackBreakdown(count: number, stackSize = 64): { stacks: number; remainder: number; shulkers: number } {
  return { stacks: Math.floor(count / stackSize), remainder: count % stackSize, shulkers: count / (27 * stackSize) };
}
