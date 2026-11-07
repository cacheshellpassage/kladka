/**
 * Game adapter contract. The planner, viewer and UI only talk to games through this interface,
 * so another voxel game (e.g. Hytale `.prefab.json`) can be added as a new adapter.
 */
import type { BlockState, GameId } from "../model/blockstate";
import type { VoxelModel } from "../model/model";
import type { BlockInfo } from "./minecraft-java/blocks";
import type { ItemCount } from "./minecraft-java/items";
import type { ShapeGeometry } from "./minecraft-java/shapes";
import type { Locale } from "./minecraft-java/names";

export interface GameAdapter {
  id: GameId;
  displayName: string;
  versionLabel: string;
  dataVersion: number;
  blockInfo(name: string): BlockInfo;
  materialOf(s: BlockState): string;
  shape(s: BlockState): ShapeGeometry;
  itemsFor(s: BlockState): ItemCount[];
  stackSize(item: string): number;
  itemName(item: string, locale: Locale): string;
  /** Post-processing for generated/edited models (connections, shapes). */
  finalize(m: VoxelModel): void;
}
