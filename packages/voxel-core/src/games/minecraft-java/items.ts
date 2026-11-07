/**
 * Mapping from placed block states to the items a player needs (for material lists).
 */
import { shortId, type BlockState } from "../../model/blockstate";
import { blockInfo } from "./blocks";

export interface ItemCount {
  item: string;
  count: number;
}

const DIRECT: Record<string, string | null> = {
  wall_torch: "torch",
  soul_wall_torch: "soul_torch",
  redstone_wall_torch: "redstone_torch",
  water: "water_bucket",
  lava: "lava_bucket",
  powder_snow: "powder_snow_bucket",
  bubble_column: null,
  fire: null,
  soul_fire: null,
  moving_piston: null,
  piston_head: null,
  frosted_ice: null,
  tripwire: "string",
  redstone_wire: "redstone",
  wheat: "wheat_seeds",
  carrots: "carrot",
  potatoes: "potato",
  beetroots: "beetroot_seeds",
  cocoa: "cocoa_beans",
  sweet_berry_bush: "sweet_berries",
  melon_stem: "melon_seeds",
  pumpkin_stem: "pumpkin_seeds",
  attached_melon_stem: "melon_seeds",
  attached_pumpkin_stem: "pumpkin_seeds",
  kelp_plant: "kelp",
  cave_vines: "glow_berries",
  cave_vines_plant: "glow_berries",
  big_dripleaf_stem: "big_dripleaf",
  twisting_vines_plant: "twisting_vines",
  weeping_vines_plant: "weeping_vines",
  bamboo_sapling: "bamboo",
  torchflower_crop: "torchflower_seeds",
  pitcher_crop: "pitcher_pod",
  tall_seagrass: "seagrass",
  water_cauldron: "cauldron",
  lava_cauldron: "cauldron",
  powder_snow_cauldron: "cauldron",
  farmland: "dirt",
  dirt_path: "dirt",
  structure_void: null,
  barrier: null,
  light: null,
};

const DOUBLE_TALL_PLANTS = new Set([
  "sunflower",
  "lilac",
  "rose_bush",
  "peony",
  "tall_grass",
  "large_fern",
  "pitcher_plant",
  "tall_dry_grass",
]);

/** Items needed to place one block state (empty when nothing has to be placed). */
export function itemsFor(state: BlockState): ItemCount[] {
  const s = shortId(state.name);
  const info = blockInfo(state.name);
  if (info.shape === "air") return [];
  const p = state.props;

  if (s in DIRECT) {
    const it = DIRECT[s];
    if (it === null || it === undefined) return [];
    if ((s === "water" || s === "lava") && p.level && p.level !== "0") return [];
    return [{ item: it, count: 1 }];
  }
  // Upper halves are placed together with the lower half.
  if (info.shape === "door" && p.half === "upper") return [];
  if (DOUBLE_TALL_PLANTS.has(s) && p.half === "upper") return [];
  if (info.shape === "bed" && p.part === "head") return [];
  if (info.shape === "slab" && p.type === "double") return [{ item: s, count: 2 }];
  if (s.endsWith("_wall_sign")) return [{ item: s.replace(/_wall_sign$/, "_sign"), count: 1 }];
  if (s.endsWith("_wall_hanging_sign")) return [{ item: s.replace(/_wall_hanging_sign$/, "_hanging_sign"), count: 1 }];
  if (s.endsWith("_wall_banner")) return [{ item: s.replace(/_wall_banner$/, "_banner"), count: 1 }];
  if (s.endsWith("_wall_head")) return [{ item: s.replace(/_wall_head$/, "_head"), count: 1 }];
  if (s.endsWith("_wall_skull")) return [{ item: s.replace(/_wall_skull$/, "_skull"), count: 1 }];
  if (s.endsWith("_wall_fan")) return [{ item: s.replace(/_wall_fan$/, "_fan"), count: 1 }];
  if (s.startsWith("potted_")) {
    const plant = s.slice(7);
    return [
      { item: "flower_pot", count: 1 },
      { item: plant === "azalea_bush" ? "azalea" : plant === "flowering_azalea_bush" ? "flowering_azalea" : plant, count: 1 },
    ];
  }
  if (s.endsWith("candle") && p.candles) return [{ item: s, count: Number(p.candles) || 1 }];
  if (s === "sea_pickle" && p.pickles) return [{ item: s, count: Number(p.pickles) || 1 }];
  if (s === "turtle_egg" && p.eggs) return [{ item: s, count: Number(p.eggs) || 1 }];
  if (s === "snow" && p.layers) return [{ item: "snow", count: Number(p.layers) || 1 }];
  if ((s === "pink_petals" || s === "wildflowers" || s === "leaf_litter") && p.flower_amount)
    return [{ item: s, count: Number(p.flower_amount) || 1 }];
  if ((s === "pink_petals" || s === "leaf_litter") && p.segment_amount)
    return [{ item: s, count: Number(p.segment_amount) || 1 }];
  if (s.endsWith("_candle_cake")) return [{ item: "cake", count: 1 }, { item: s.replace(/_cake$/, ""), count: 1 }];
  if (s === "candle_cake") return [{ item: "cake", count: 1 }, { item: "candle", count: 1 }];
  return [{ item: s, count: 1 }];
}

const STACK_1 = /(_bed|_bucket|_shulker_box|^shulker_box|_boat|_sword|_pickaxe|_axe|_shovel|_hoe|^cake|_minecart)$/;
const STACK_16 = /(_sign|_hanging_sign|_banner|^snowball|^ender_pearl|^egg|^armor_stand|^honey_bottle)$/;

export function stackSize(item: string): number {
  const s = shortId(item);
  if (STACK_1.test(s) || s === "cake" || s === "shulker_box") return 1;
  if (STACK_16.test(s)) return 16;
  return 64;
}

/** Items in one shulker box (27 slots). */
export function shulkerCapacity(item: string): number {
  return 27 * stackSize(item);
}
