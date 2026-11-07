/**
 * Canonical materials and their procedural look.
 *
 * Colours are our own approximations chosen by eye; no game assets are used.
 * Each material maps to a texture pattern that the viewer renders procedurally.
 */
import { shortId } from "../../model/blockstate";

export type TexPattern =
  | "plain"
  | "noise"
  | "planks"
  | "log"
  | "log_top"
  | "bricks"
  | "stone_bricks"
  | "cobble"
  | "stone"
  | "tiles"
  | "polished"
  | "smooth"
  | "leaves"
  | "glass"
  | "wool"
  | "sand"
  | "grass_top"
  | "grass_side"
  | "dirt"
  | "bookshelf"
  | "door"
  | "trapdoor"
  | "crafting_top"
  | "crafting_side"
  | "furnace"
  | "chest"
  | "glow"
  | "water"
  | "lava"
  | "metal"
  | "thatch"
  | "pillar"
  | "pillar_top"
  | "lamp"
  | "concrete"
  | "terracotta"
  | "ore"
  | "scaffold"
  | "plant"
  | "flower"
  | "torch"
  | "ladder"
  | "rail"
  | "chiseled"
  | "path_top"
  | "farmland"
  | "bars"
  | "barrel_top"
  | "barrel_side"
  | "sandstone"
  | "mosaic"
  | "shingles";

export interface TexDef {
  pattern: TexPattern;
  color: number;
  accent?: number;
}

export function texKey(t: TexDef): string {
  return `${t.pattern}:${t.color.toString(16)}:${(t.accent ?? 0).toString(16)}`;
}

/* ------------------------------------------------------------------ */
/* Wood                                                                 */
/* ------------------------------------------------------------------ */

export const WOOD_TYPES = [
  "oak",
  "spruce",
  "birch",
  "jungle",
  "acacia",
  "dark_oak",
  "mangrove",
  "cherry",
  "bamboo",
  "crimson",
  "warped",
  "pale_oak",
  "poplar",
] as const;
export type WoodType = (typeof WOOD_TYPES)[number];

interface WoodLook {
  planks: number;
  bark: number;
  barkAccent: number;
  stripped: number;
  leaves: number;
}

export const WOOD: Record<WoodType, WoodLook> = {
  oak: { planks: 0xa98853, bark: 0x6b5332, barkAccent: 0x4f3d24, stripped: 0xb39159, leaves: 0x4f9a2c },
  spruce: { planks: 0x735534, bark: 0x3e2a16, barkAccent: 0x2c1d0e, stripped: 0x80603a, leaves: 0x3d6a3d },
  birch: { planks: 0xc6b47c, bark: 0xdcd9d0, barkAccent: 0x34322f, stripped: 0xc8b882, leaves: 0x6c9a42 },
  jungle: { planks: 0xa57650, bark: 0x57461f, barkAccent: 0x3f3214, stripped: 0xae8a54, leaves: 0x3f9d1c },
  acacia: { planks: 0xae5e33, bark: 0x6a645a, barkAccent: 0x4e4a42, stripped: 0xae623a, leaves: 0x5d8f22 },
  dark_oak: { planks: 0x4b3119, bark: 0x3c2d1a, barkAccent: 0x281d10, stripped: 0x5f4630, leaves: 0x3a7a1c },
  mangrove: { planks: 0x773631, bark: 0x5b4730, barkAccent: 0x3f3020, stripped: 0x7a3a33, leaves: 0x5c8a2a },
  cherry: { planks: 0xe3b5ae, bark: 0x3d2128, barkAccent: 0x2a161b, stripped: 0xd99a95, leaves: 0xeaa9c6 },
  bamboo: { planks: 0xc9b457, bark: 0x7b8f2f, barkAccent: 0x5c6c22, stripped: 0xc2ad4f, leaves: 0x6aa02e },
  crimson: { planks: 0x6a344b, bark: 0x5e1a33, barkAccent: 0x8a2a3e, stripped: 0x8a3a52, leaves: 0x8b1a1a },
  warped: { planks: 0x2c6e68, bark: 0x3a3550, barkAccent: 0x1f8f80, stripped: 0x3a8a80, leaves: 0x167e74 },
  pale_oak: { planks: 0xe6dcd6, bark: 0x6f6963, barkAccent: 0x524d48, stripped: 0xece4de, leaves: 0x8a9286 },
  poplar: { planks: 0xd9caa3, bark: 0x9d9a8f, barkAccent: 0x6e6b62, stripped: 0xe0d2ad, leaves: 0x9fbd4a },
};

export const DYE_COLORS = [
  "white",
  "orange",
  "magenta",
  "light_blue",
  "yellow",
  "lime",
  "pink",
  "gray",
  "light_gray",
  "cyan",
  "purple",
  "blue",
  "brown",
  "green",
  "red",
  "black",
] as const;
export type DyeColor = (typeof DYE_COLORS)[number];

export const DYE: Record<DyeColor, number> = {
  white: 0xe9ecec,
  orange: 0xf07613,
  magenta: 0xbd44b3,
  light_blue: 0x3aafd9,
  yellow: 0xf8c627,
  lime: 0x70b919,
  pink: 0xed8dac,
  gray: 0x3e4447,
  light_gray: 0x8e8e86,
  cyan: 0x158991,
  purple: 0x792aac,
  blue: 0x35399d,
  brown: 0x724728,
  green: 0x546d1b,
  red: 0xa12722,
  black: 0x1d1d21,
};

/** Muted variant used for terracotta. */
function muted(c: number, k = 0.55, base = 0x9a6a55): number {
  const mix = (a: number, b: number) => Math.round(a * k + b * (1 - k));
  const r = mix((c >> 16) & 255, (base >> 16) & 255);
  const g = mix((c >> 8) & 255, (base >> 8) & 255);
  const b = mix(c & 255, base & 255);
  return (r << 16) | (g << 8) | b;
}

/* ------------------------------------------------------------------ */
/* Material table                                                        */
/* ------------------------------------------------------------------ */

type MatEntry = [TexPattern, number, number?];

const M: Record<string, MatEntry> = {
  stone: ["stone", 0x7e7e7e, 0x6c6c6c],
  smooth_stone: ["smooth", 0x9f9f9f, 0x8a8a8a],
  cobblestone: ["cobble", 0x7b7b7b, 0x5a5a5a],
  mossy_cobblestone: ["cobble", 0x6e7a5e, 0x4f6b35],
  stone_bricks: ["stone_bricks", 0x7a7a7a, 0x5f5f5f],
  mossy_stone_bricks: ["stone_bricks", 0x737d66, 0x55703a],
  cracked_stone_bricks: ["stone_bricks", 0x777777, 0x555555],
  chiseled_stone_bricks: ["chiseled", 0x7a7a7a, 0x5f5f5f],
  andesite: ["stone", 0x888889, 0x737374],
  polished_andesite: ["polished", 0x84888a, 0x6f7375],
  diorite: ["stone", 0xbdbdbe, 0x9d9d9e],
  polished_diorite: ["polished", 0xc1c1c3, 0xa5a5a8],
  granite: ["stone", 0x956755, 0x7d5544],
  polished_granite: ["polished", 0x9a6a58, 0x845848],
  deepslate: ["stone", 0x515155, 0x3f3f43],
  cobbled_deepslate: ["cobble", 0x4d4d51, 0x353538],
  polished_deepslate: ["polished", 0x48484a, 0x3a3a3c],
  deepslate_bricks: ["stone_bricks", 0x474749, 0x333335],
  deepslate_tiles: ["tiles", 0x37373a, 0x2a2a2c],
  chiseled_deepslate: ["chiseled", 0x37373a, 0x2a2a2c],
  tuff: ["stone", 0x6c6d66, 0x5b5c55],
  polished_tuff: ["polished", 0x626660, 0x535750],
  tuff_bricks: ["stone_bricks", 0x62675f, 0x4d5149],
  calcite: ["smooth", 0xdfe0dc, 0xcfd0cc],
  blackstone: ["stone", 0x2c262c, 0x1f1a1f],
  polished_blackstone: ["polished", 0x35303a, 0x27232b],
  polished_blackstone_bricks: ["stone_bricks", 0x302b32, 0x221e24],
  basalt: ["pillar", 0x515156, 0x3a3a3e],
  sandstone: ["sandstone", 0xd9cc9c, 0xc4b682],
  cut_sandstone: ["sandstone", 0xdbd0a2, 0xc4b682],
  smooth_sandstone: ["smooth", 0xdcd0a0, 0xd0c494],
  chiseled_sandstone: ["chiseled", 0xd9cc9c, 0xb8a874],
  red_sandstone: ["sandstone", 0xb5621f, 0x9a5119],
  cut_red_sandstone: ["sandstone", 0xb9661f, 0x9a5119],
  smooth_red_sandstone: ["smooth", 0xb5621f, 0xaa5a1c],
  bricks: ["bricks", 0x97604f, 0xb8b0a5],
  mud_bricks: ["bricks", 0x8a6a4f, 0x6e533c],
  packed_mud: ["noise", 0x8e6b50, 0x7d5d44],
  nether_bricks: ["bricks", 0x2c161a, 0x1b0d10],
  red_nether_bricks: ["bricks", 0x470709, 0x2d0405],
  end_stone: ["stone", 0xdbde9f, 0xc9cb8c],
  end_stone_bricks: ["stone_bricks", 0xdadd9f, 0xc1c387],
  purpur_block: ["tiles", 0xa97da9, 0x8d638d],
  purpur_pillar: ["pillar", 0xab80ab, 0x8d638d],
  prismarine: ["stone", 0x63a397, 0x4d8a80],
  prismarine_bricks: ["stone_bricks", 0x63ab9e, 0x4b8b80],
  dark_prismarine: ["tiles", 0x335b4b, 0x24433a],
  quartz_block: ["smooth", 0xece6df, 0xddd5cc],
  smooth_quartz: ["smooth", 0xece6df, 0xe2dbd3],
  quartz_bricks: ["stone_bricks", 0xeae4dd, 0xd4ccc2],
  quartz_pillar: ["pillar", 0xebe5dd, 0xd8d0c6],
  chiseled_quartz_block: ["chiseled", 0xe8e2da, 0xd2cabf],
  terracotta: ["terracotta", 0x985e43, 0x8a543b],
  clay: ["noise", 0xa1a7b3, 0x939aa6],
  dirt: ["dirt", 0x866043, 0x6b4c34],
  coarse_dirt: ["dirt", 0x77553b, 0x5b412d],
  rooted_dirt: ["dirt", 0x90684d, 0x6b4c34],
  podzol: ["dirt", 0x5c3f19, 0x7a5a2e],
  mud: ["noise", 0x3c3a3e, 0x2f2d31],
  grass_block: ["grass_top", 0x6aa74a, 0x866043],
  dirt_path: ["path_top", 0x9a7f48, 0x866043],
  farmland: ["farmland", 0x5c3d22, 0x866043],
  sand: ["sand", 0xdcd3a0, 0xcdc28c],
  red_sand: ["sand", 0xbe6721, 0xa85a1c],
  gravel: ["cobble", 0x857f7d, 0x6a6462],
  snow_block: ["noise", 0xf6fbfb, 0xe6eef0],
  snow: ["noise", 0xf6fbfb, 0xe6eef0],
  ice: ["glass", 0x91b7fd, 0xc9dcff],
  packed_ice: ["noise", 0x8db3f9, 0x7da2e8],
  blue_ice: ["noise", 0x74a8fd, 0x6497ee],
  moss_block: ["noise", 0x596e2d, 0x4b5f25],
  pale_moss_block: ["noise", 0x6b7466, 0x5d665a],
  hay_block: ["thatch", 0xb39813, 0x8b6f0e],
  glass: ["glass", 0xd6eef2, 0xffffff],
  tinted_glass: ["glass", 0x2c2731, 0x4a3f55],
  glowstone: ["glow", 0xd2a75c, 0xf8d494],
  sea_lantern: ["glow", 0xb5d4c8, 0xe8f6ef],
  shroomlight: ["glow", 0xf09b4b, 0xffc47a],
  redstone_lamp: ["lamp", 0x9a6a3a, 0xf3c37c],
  ochre_froglight: ["glow", 0xf6e6a8, 0xffffd8],
  verdant_froglight: ["glow", 0xe1f0d7, 0xffffff],
  pearlescent_froglight: ["glow", 0xf2e2ec, 0xffffff],
  jack_o_lantern: ["glow", 0xc57618, 0xffd34a],
  pumpkin: ["noise", 0xc57618, 0xa45f10],
  carved_pumpkin: ["noise", 0xc57618, 0xa45f10],
  melon: ["noise", 0x6f9a2a, 0x5a7f20],
  bookshelf: ["bookshelf", 0xa98853, 0x7a3b2a],
  chiseled_bookshelf: ["bookshelf", 0xa98853, 0x5a3b9a],
  crafting_table: ["crafting_side", 0x9a6c3c, 0x6b4a2a],
  cartography_table: ["crafting_side", 0x6a4d35, 0xd8d0b8],
  fletching_table: ["crafting_side", 0xc9b483, 0x7d6d4c],
  smithing_table: ["crafting_side", 0x3a3a44, 0x6b4a2a],
  loom: ["crafting_side", 0xb8a07a, 0x8b6f4c],
  furnace: ["furnace", 0x6d6d6d, 0x2b2b2b],
  smoker: ["furnace", 0x5d5650, 0x3b2b20],
  blast_furnace: ["furnace", 0x505055, 0x2b2b30],
  chest: ["chest", 0xa2742f, 0x5c4120],
  trapped_chest: ["chest", 0xa2742f, 0x7a2020],
  ender_chest: ["chest", 0x1f2b2b, 0x2a7d6a],
  barrel: ["barrel_side", 0x86643b, 0x5a4428],
  composter: ["planks", 0x8a6236, 0x5a4428],
  lectern: ["planks", 0xa98853, 0x7a5a32],
  beehive: ["planks", 0xc9a160, 0x8a6a36],
  bee_nest: ["noise", 0xd8b35a, 0x9a7a36],
  jukebox: ["planks", 0x8a5a3e, 0x3b2b20],
  note_block: ["planks", 0x6b4a32, 0x3b2b20],
  scaffolding: ["scaffold", 0xc9a85a, 0x9a7a36],
  iron_block: ["metal", 0xdcdcdc, 0xbfbfbf],
  gold_block: ["metal", 0xf6d33d, 0xdcb22c],
  diamond_block: ["metal", 0x62ede4, 0x4ad0c8],
  emerald_block: ["metal", 0x2acb57, 0x1ea444],
  lapis_block: ["metal", 0x1f43a3, 0x163281],
  redstone_block: ["metal", 0xb01a06, 0x8a1404],
  netherite_block: ["metal", 0x433d40, 0x352f32],
  copper_block: ["metal", 0xc0694f, 0xa15a43],
  cut_copper: ["tiles", 0xbf6b51, 0x9e5640],
  exposed_copper: ["metal", 0xa17e68, 0x8a6a56],
  exposed_cut_copper: ["tiles", 0x9b7a65, 0x7d604f],
  weathered_copper: ["metal", 0x6c9a6c, 0x5a8558],
  weathered_cut_copper: ["tiles", 0x6d9168, 0x587a54],
  oxidized_copper: ["metal", 0x52a284, 0x438a6f],
  oxidized_cut_copper: ["tiles", 0x4f9a7d, 0x3f8068],
  iron_bars: ["bars", 0x8a8d8f, 0x6a6d6f],
  chain: ["bars", 0x3d4352, 0x2a2f3a],
  anvil: ["metal", 0x444444, 0x333333],
  cauldron: ["metal", 0x3d3d3f, 0x2a2a2c],
  hopper: ["metal", 0x4a4a4c, 0x333335],
  bell: ["metal", 0xe8c13a, 0xb89020],
  lantern: ["torch", 0x4a4a52, 0xffc75a],
  soul_lantern: ["torch", 0x4a4a52, 0x7de6f0],
  torch: ["torch", 0x7a5a32, 0xffd860],
  soul_torch: ["torch", 0x7a5a32, 0x7de6f0],
  redstone_torch: ["torch", 0x7a5a32, 0xff3020],
  campfire: ["torch", 0x6b5332, 0xffa030],
  soul_campfire: ["torch", 0x6b5332, 0x60e0f0],
  end_rod: ["glow", 0xf0e8e0, 0xffffff],
  candle: ["plain", 0xe3d6b5, 0xffd860],
  ladder: ["ladder", 0x9a7a45, 0x6b5332],
  rail: ["rail", 0x7a7a7a, 0x6b5332],
  powered_rail: ["rail", 0xc9a33a, 0x6b5332],
  detector_rail: ["rail", 0x8a6a5a, 0x6b5332],
  activator_rail: ["rail", 0xa04a3a, 0x6b5332],
  water: ["water", 0x3f6fe0, 0x5a88f0],
  lava: ["lava", 0xd4601a, 0xffa020],
  cobweb: ["plant", 0xe6e6e6, 0xffffff],
  flower_pot: ["plain", 0x7a4535, 0x5a3328],
  bamboo_block: ["log", 0x7b8f2f, 0x5c6c22],
  stripped_bamboo_block: ["log", 0xc2ad4f, 0x9a8a3a],
  bamboo_mosaic: ["mosaic", 0xc9b457, 0x9a8a3a],
  dried_kelp_block: ["noise", 0x3a3d2a, 0x2b2d1f],
  sponge: ["noise", 0xc9c24a, 0xaaa338],
  slime_block: ["glass", 0x6fc05a, 0x8fe07a],
  honey_block: ["glass", 0xf2a63a, 0xffc25a],
  obsidian: ["noise", 0x15111d, 0x2a1f3d],
  crying_obsidian: ["noise", 0x200a3d, 0x6a20c0],
  netherrack: ["noise", 0x6f3535, 0x5a2a2a],
  soul_sand: ["sand", 0x51402f, 0x3d3024],
  soul_soil: ["dirt", 0x4b3a2c, 0x3b2d22],
  magma_block: ["lava", 0x8e3f1a, 0xd4601a],
  amethyst_block: ["noise", 0x8662bf, 0xa682d9],
  dripstone_block: ["stone", 0x866a5c, 0x6e5649],
  resin_block: ["noise", 0xd9661f, 0xb54f14],
  resin_bricks: ["bricks", 0xcf5f1c, 0xa34812],
  straw_block: ["thatch", 0xc9b06a, 0xa18a4c],
  pointed_dripstone: ["stone", 0x866a5c, 0x6e5649],
};

// Wood-derived materials.
for (const w of WOOD_TYPES) {
  const look = WOOD[w];
  const planks = w === "bamboo" ? "bamboo_planks" : `${w}_planks`;
  M[planks] = ["planks", look.planks, shade(look.planks, 0.78)];
  const isNether = w === "crimson" || w === "warped";
  const log = isNether ? `${w}_stem` : w === "bamboo" ? "bamboo_block" : `${w}_log`;
  const wood = isNether ? `${w}_hyphae` : `${w}_wood`;
  if (w !== "bamboo") {
    M[log] = ["log", look.bark, look.barkAccent];
    M[wood] = ["log", look.bark, look.barkAccent];
    M[`stripped_${log}`] = ["log", look.stripped, shade(look.stripped, 0.85)];
    M[`stripped_${wood}`] = ["log", look.stripped, shade(look.stripped, 0.85)];
  }
  const leaves = isNether ? (w === "crimson" ? "nether_wart_block" : "warped_wart_block") : `${w}_leaves`;
  M[leaves] = isNether ? ["noise", look.leaves, shade(look.leaves, 0.8)] : ["leaves", look.leaves, shade(look.leaves, 0.7)];
}
M["azalea_leaves"] = ["leaves", 0x5a7a2a, 0x46601f];
M["flowering_azalea_leaves"] = ["leaves", 0x5f7d2f, 0xd27fc0];

// Colour families.
for (const c of DYE_COLORS) {
  const col = DYE[c];
  M[`${c}_wool`] = ["wool", col, shade(col, 0.85)];
  M[`${c}_concrete`] = ["concrete", col, shade(col, 0.95)];
  M[`${c}_concrete_powder`] = ["sand", lighten(col, 0.25), col];
  M[`${c}_terracotta`] = ["terracotta", muted(col), shade(muted(col), 0.9)];
  M[`${c}_glazed_terracotta`] = ["tiles", col, lighten(col, 0.4)];
  M[`${c}_stained_glass`] = ["glass", col, lighten(col, 0.4)];
  M[`${c}_bed`] = ["wool", col, 0xe8e0d0];
  M[`${c}_banner`] = ["wool", col, shade(col, 0.8)];
  M[`${c}_candle`] = ["plain", col, 0xffd860];
  M[`${c}_shulker_box`] = ["concrete", col, shade(col, 0.8)];
}

export function shade(c: number, k: number): number {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
}

export function lighten(c: number, k: number): number {
  const f = (v: number) => Math.round(v + (255 - v) * k);
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
}

/** Deterministic colour for unknown materials (so imports of modded blocks still render). */
export function hashColor(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = (h >>> 0) % 360;
  const s = 0.35,
    l = 0.5;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

/* ------------------------------------------------------------------ */
/* id → canonical material                                              */
/* ------------------------------------------------------------------ */

const WOOD_SUFFIXES = [
  "planks",
  "stairs",
  "slab",
  "fence",
  "fence_gate",
  "door",
  "trapdoor",
  "button",
  "pressure_plate",
  "sign",
  "wall_sign",
  "hanging_sign",
  "wall_hanging_sign",
  "shelf",
];

const SHAPE_SUFFIX = /_(stairs|slab|wall)$/;

/**
 * Canonical material for a block id: the full block that a shaped variant is made of
 * (oak_stairs → oak_planks, stone_brick_wall → stone_bricks, white_carpet → white_wool).
 */
export function canonicalMaterial(name: string): string {
  const s = shortId(name);
  if (name.includes(":") && !name.startsWith("minecraft:")) return name;

  for (const w of WOOD_TYPES) {
    if (!s.startsWith(w + "_")) continue;
    const rest = s.slice(w.length + 1);
    if (WOOD_SUFFIXES.includes(rest)) return w === "bamboo" ? "bamboo_planks" : `${w}_planks`;
    if (rest === "mosaic_stairs" || rest === "mosaic_slab") return "bamboo_mosaic";
  }
  if (s === "petrified_oak_slab") return "oak_planks";
  if (s === "glass_pane") return "glass";
  if (s.endsWith("_stained_glass_pane")) return s.slice(0, -5);
  if (s === "moss_carpet") return "moss_block";
  if (s === "pale_moss_carpet") return "pale_moss_block";
  if (s.endsWith("_carpet")) return s.replace(/_carpet$/, "_wool");
  if (s === "wall_torch") return "torch";
  if (s === "soul_wall_torch") return "soul_torch";
  if (s === "redstone_wall_torch") return "redstone_torch";
  if (s.endsWith("_wall_banner")) return s.replace(/_wall_banner$/, "_banner");
  if (s.endsWith("_candle_cake")) return "cake";
  if (s.startsWith("potted_")) return "flower_pot";
  if (s.startsWith("waxed_")) return canonicalMaterial("minecraft:" + s.slice(6));
  if (s.startsWith("infested_")) return canonicalMaterial("minecraft:" + s.slice(9));
  if (s === "smooth_stone_slab") return "smooth_stone";
  if (s === "stone_stairs" || s === "stone_slab") return "stone";
  if (s === "quartz_stairs" || s === "quartz_slab") return "quartz_block";
  if (s === "purpur_stairs" || s === "purpur_slab") return "purpur_block";
  if (s === "brick_stairs" || s === "brick_slab" || s === "brick_wall") return "bricks";
  if (s === "nether_brick_fence") return "nether_bricks";
  const m = SHAPE_SUFFIX.exec(s);
  if (m) {
    const base = s.slice(0, m.index);
    if (base.endsWith("_brick")) return base + "s";
    if (base.endsWith("_tile")) return base + "s";
    if (base.endsWith("_copper")) return base;
    if (M[base]) return base;
    if (M[base + "_block"]) return base + "_block";
    if (M[base + "s"]) return base + "s";
    return base;
  }
  return s;
}

export function materialLook(material: string): TexDef {
  const e = M[material];
  if (e) return { pattern: e[0], color: e[1], accent: e[2] ?? shade(e[1], 0.8) };
  const c = hashColor(material);
  return { pattern: "noise", color: c, accent: shade(c, 0.8) };
}

export function hasMaterial(material: string): boolean {
  return material in M;
}
