/**
 * Build "passport": which game version a file was saved in, the oldest Java version that has every block
 * it uses, mods it needs, how many block types it has and its size class.
 *
 * The block → version table covers the blocks added since the 1.13 "flattening" up to 1.21.9. Blocks newer
 * than that table (or unknown modded ids) cannot raise the minimum, so the answer is "this version or newer".
 */
import type { VoxelModel } from "../../model/model";
import { MC_DATA_VERSION, MC_VERSION } from "./version";

/** DataVersion → release name (Java Edition). */
export const DATA_VERSIONS: Array<[number, string]> = [
  [1139, "1.12"],
  [1343, "1.12.2"],
  [1519, "1.13"],
  [1631, "1.13.2"],
  [1952, "1.14"],
  [1976, "1.14.4"],
  [2225, "1.15"],
  [2230, "1.15.2"],
  [2566, "1.16"],
  [2586, "1.16.5"],
  [2724, "1.17"],
  [2730, "1.17.1"],
  [2860, "1.18"],
  [2975, "1.18.2"],
  [3105, "1.19"],
  [3120, "1.19.2"],
  [3218, "1.19.3"],
  [3337, "1.19.4"],
  [3463, "1.20"],
  [3465, "1.20.1"],
  [3578, "1.20.2"],
  [3698, "1.20.3"],
  [3700, "1.20.4"],
  [3837, "1.20.5"],
  [3839, "1.20.6"],
  [3953, "1.21"],
  [3955, "1.21.1"],
  [4080, "1.21.2"],
  [4082, "1.21.3"],
  [4189, "1.21.4"],
  [4325, "1.21.5"],
  [4435, "1.21.6"],
  [4438, "1.21.7"],
  [4440, "1.21.8"],
  [4554, "1.21.9"],
  [4556, "1.21.10"],
  [MC_DATA_VERSION, MC_VERSION],
];

/** Human-readable version for a DataVersion ("1.21.4", "1.21.10+" between known releases). */
export function versionName(dataVersion: number): string {
  if (!dataVersion) return "?";
  let best: [number, string] | undefined;
  for (const e of DATA_VERSIONS) if (e[0] <= dataVersion) best = e;
  if (!best) return `< ${DATA_VERSIONS[0]![1]}`;
  return best[0] === dataVersion ? best[1] : `${best[1]}+`;
}

const V = (name: string) => DATA_VERSIONS.find((e) => e[1] === name)![0];

/** [pattern, DataVersion of the release that added the block]. Several rules may match; the newest wins. */
const SINCE: Array<[RegExp, number]> = [
  // 1.14 Village & Pillage
  [
    /^(barrel|smoker|blast_furnace|cartography_table|fletching_table|grindstone|lectern|smithing_table|stonecutter|bell|lantern|campfire|scaffolding|composter|sweet_berry_bush|jigsaw|bamboo|bamboo_sapling|cornflower|lily_of_the_valley|wither_rose|smooth_stone_slab)$/,
    V("1.14"),
  ],
  [/^potted_(bamboo|cornflower|lily_of_the_valley|wither_rose)$/, V("1.14")],
  [/^(oak|spruce|birch|jungle|acacia|dark_oak)_(wall_)?sign$/, V("1.14")],
  [
    /^(stone|granite|polished_granite|diorite|polished_diorite|andesite|polished_andesite|mossy_cobblestone|mossy_stone_brick|smooth_sandstone|smooth_red_sandstone|smooth_quartz|red_nether_brick|end_stone_brick)_stairs$/,
    V("1.14"),
  ],
  [
    /^(granite|polished_granite|diorite|polished_diorite|andesite|polished_andesite|mossy_cobblestone|mossy_stone_brick|smooth_sandstone|smooth_red_sandstone|smooth_quartz|red_nether_brick|end_stone_brick)_slab$/,
    V("1.14"),
  ],
  [
    /^(brick|prismarine|red_sandstone|mossy_stone_brick|granite|stone_brick|nether_brick|andesite|red_nether_brick|sandstone|end_stone_brick|diorite)_wall$/,
    V("1.14"),
  ],
  // 1.15 Buzzy Bees
  [/^(bee_nest|beehive|honey_block|honeycomb_block)$/, V("1.15")],
  // 1.16 Nether Update
  [/^(crimson|warped)_/, V("1.16")],
  [/blackstone/, V("1.16")],
  [
    /^(netherite_block|ancient_debris|basalt|polished_basalt|soul_soil|soul_lantern|soul_torch|soul_wall_torch|soul_campfire|soul_fire|chain|target|respawn_anchor|lodestone|crying_obsidian|shroomlight|nether_gold_ore|quartz_bricks|chiseled_nether_bricks|cracked_nether_bricks|twisting_vines|twisting_vines_plant|weeping_vines|weeping_vines_plant|nether_sprouts)$/,
    V("1.16"),
  ],
  // 1.17 Caves & Cliffs I
  [/copper/, V("1.17")],
  [/amethyst/, V("1.17")],
  [/deepslate/, V("1.17")],
  [/candle/, V("1.17")],
  [
    /^(tuff|calcite|dripstone_block|pointed_dripstone|moss_block|moss_carpet|azalea|flowering_azalea|azalea_leaves|flowering_azalea_leaves|rooted_dirt|hanging_roots|spore_blossom|big_dripleaf|big_dripleaf_stem|small_dripleaf|glow_lichen|lightning_rod|powder_snow|smooth_basalt|raw_iron_block|raw_copper_block|raw_gold_block|tinted_glass|sculk_sensor|cave_vines|cave_vines_plant|potted_azalea_bush|potted_flowering_azalea_bush)$/,
    V("1.17"),
  ],
  // 1.19 The Wild Update
  [/mangrove/, V("1.19")],
  [
    /^(mud|packed_mud|muddy_mangrove_roots|sculk|sculk_vein|sculk_catalyst|sculk_shrieker|frogspawn|reinforced_deepslate)$/,
    V("1.19"),
  ],
  [/mud_brick/, V("1.19")],
  [/froglight$/, V("1.19")],
  // 1.20 Trails & Tales
  [/cherry/, V("1.20")],
  [
    /^(stripped_)?bamboo_(planks|mosaic|block|stairs|slab|fence|fence_gate|door|trapdoor|button|pressure_plate|sign|wall_sign|mosaic_stairs|mosaic_slab)$/,
    V("1.20"),
  ],
  [/_hanging_sign$/, V("1.20")],
  [
    /^(chiseled_bookshelf|decorated_pot|suspicious_sand|suspicious_gravel|pink_petals|torchflower|torchflower_crop|potted_torchflower|pitcher_plant|pitcher_crop|calibrated_sculk_sensor|sniffer_egg|piglin_head|piglin_wall_head)$/,
    V("1.20"),
  ],
  // 1.20.3: "grass" was renamed
  [/^short_grass$/, V("1.20.3")],
  // 1.21 Tricky Trials
  [/^(crafter|trial_spawner|vault|heavy_core)$/, V("1.21")],
  [/(^|_)tuff_|^(polished|chiseled)_tuff$/, V("1.21")],
  [/copper_(bulb|grate|door|trapdoor)$|chiseled_copper$/, V("1.21")],
  // 1.21.4 The Garden Awakens
  [/pale_oak|pale_moss|pale_hanging_moss|resin/, V("1.21.4")],
  [
    /^(creaking_heart|open_eyeblossom|closed_eyeblossom|potted_open_eyeblossom|potted_closed_eyeblossom)$/,
    V("1.21.4"),
  ],
  // 1.21.5 Spring to Life
  [
    /^(leaf_litter|wildflowers|bush|firefly_bush|short_dry_grass|tall_dry_grass|cactus_flower|test_block|test_instance_block)$/,
    V("1.21.5"),
  ],
  // 1.21.6 Chase the Skies
  [/^dried_ghast$/, V("1.21.6")],
  // 1.21.9 The Copper Age
  [/copper_(chest|golem_statue|lantern|torch|wall_torch|bars|chain)$|_shelf$|^iron_chain$/, V("1.21.9")],
];

/** DataVersion of the oldest release that has this block (0 when it existed in 1.13 or is unknown). */
export function blockSince(name: string): number {
  const [ns, id] = name.includes(":") ? (name.split(":") as [string, string]) : ["minecraft", name];
  if (ns !== "minecraft") return 0;
  let v = 0;
  for (const [re, dv] of SINCE) if (re.test(id) && dv > v) v = dv;
  return v;
}

export type SizeClass = "S" | "M" | "L" | "XL";

export interface BuildPassport {
  /** Distinct block ids (block states of one block count once). */
  blockTypes: number;
  blocks: number;
  sizeClass: SizeClass;
  /** DataVersion stored in the file (0 if unknown). */
  savedDataVersion: number;
  savedIn: string;
  /** Oldest release that has every vanilla block of the build. */
  minDataVersion: number;
  minVersion: string;
  /** Blocks that set the minimum (up to 3 examples). */
  newestBlocks: string[];
  /** Non-vanilla namespaces and how many blocks use them. */
  mods: Array<{ namespace: string; blocks: number }>;
}

export function sizeClassOf(blocks: number): SizeClass {
  return blocks < 1000 ? "S" : blocks < 10_000 ? "M" : blocks < 100_000 ? "L" : "XL";
}

export function buildPassport(m: VoxelModel): BuildPassport {
  const perPalette = new Uint32Array(m.palette.length);
  for (const p of m.blocks) if (p) perPalette[p]!++;
  const ids = new Set<string>();
  const mods = new Map<string, number>();
  let blocks = 0;
  let minDv = DATA_VERSIONS.find((e) => e[1] === "1.13")![0];
  let newest: string[] = [];
  m.palette.forEach((st, i) => {
    const n = perPalette[i]!;
    if (!i || !n || /(^|:)(air|cave_air|void_air)$/.test(st.name)) return;
    blocks += n;
    ids.add(st.name);
    const ns = st.name.includes(":") ? st.name.slice(0, st.name.indexOf(":")) : "minecraft";
    if (ns !== "minecraft") mods.set(ns, (mods.get(ns) ?? 0) + n);
    const since = blockSince(st.name);
    if (since > minDv) {
      minDv = since;
      newest = [st.name];
    } else if (since === minDv && since > 0 && newest.length < 3 && !newest.includes(st.name))
      newest.push(st.name);
  });
  return {
    blockTypes: ids.size,
    blocks,
    sizeClass: sizeClassOf(blocks),
    savedDataVersion: m.dataVersion,
    savedIn: versionName(m.dataVersion),
    minDataVersion: minDv,
    minVersion: versionName(minDv),
    newestBlocks: newest,
    mods: [...mods].map(([namespace, n]) => ({ namespace, blocks: n })).sort((a, b) => b.blocks - a.blocks),
  };
}
