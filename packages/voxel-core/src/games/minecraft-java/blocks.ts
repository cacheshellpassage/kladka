/**
 * Block knowledge for Minecraft Java Edition: shape class, render layer, textures, role hints and
 * placement (support) rules. Everything is derived from block ids by rules written for this project;
 * no game data files are used.
 */
import { shortId, type BlockState } from "../../model/blockstate";
import {
  DYE_COLORS,
  WOOD,
  WOOD_TYPES,
  canonicalMaterial,
  lighten,
  materialLook,
  shade,
  type TexDef,
  type WoodType,
} from "./materials";

export type ShapeKind =
  | "air"
  | "cube"
  | "slab"
  | "stairs"
  | "fence"
  | "fence_gate"
  | "wall"
  | "pane"
  | "door"
  | "trapdoor"
  | "torch"
  | "wall_torch"
  | "lantern"
  | "ladder"
  | "carpet"
  | "cross"
  | "crop"
  | "bed"
  | "chest"
  | "button"
  | "plate"
  | "layer"
  | "liquid"
  | "rail"
  | "sign"
  | "wall_sign"
  | "hanging_sign"
  | "banner"
  | "wall_banner"
  | "pot"
  | "chain"
  | "candle"
  | "campfire"
  | "path"
  | "rod"
  | "small"
  | "vine"
  | "anvil"
  | "lectern"
  | "table"
  | "cake"
  | "bell"
  | "head"
  | "hopper"
  | "cauldron";

export type RenderLayer = "opaque" | "cutout" | "translucent" | "none";

/** Coarse hint used by the role classifier. */
export type RoleHint =
  | "structural"
  | "frame"
  | "opening"
  | "interior"
  | "decor"
  | "light"
  | "liquid"
  | "fence"
  | "nature";

/**
 * Where a block needs support to be placed (survival rules, simplified):
 * - none: can be placed against any neighbour
 * - below: needs the block underneath
 * - back: needs the block behind it (opposite of `facing`), e.g. wall torches, ladders, wall signs
 * - above: hangs from the block above
 * - face: button/lever – depends on `face` prop (floor/wall/ceiling)
 * - hanging: lantern/hanging sign – above when hanging=true/attached, else below
 */
export type AttachRule = "none" | "below" | "back" | "above" | "face" | "hanging";

export interface BlockInfo {
  id: string;
  shape: ShapeKind;
  render: RenderLayer;
  /** Fully occludes neighbouring faces. */
  full: boolean;
  tex: { top: TexDef; side: TexDef; bottom: TexDef };
  /** Colour for 2D plans and thumbnails (0xRRGGBB). */
  color: number;
  /** 0..1 light emission (used for glow/bloom). */
  emissive: number;
  hint: RoleHint;
  attach: AttachRule;
  gravity: boolean;
  material: string;
}

/* ------------------------------------------------------------------ */

const LIGHT_IDS = new Set([
  "torch",
  "wall_torch",
  "soul_torch",
  "soul_wall_torch",
  "redstone_torch",
  "redstone_wall_torch",
  "lantern",
  "soul_lantern",
  "glowstone",
  "sea_lantern",
  "shroomlight",
  "redstone_lamp",
  "jack_o_lantern",
  "end_rod",
  "campfire",
  "soul_campfire",
  "ochre_froglight",
  "verdant_froglight",
  "pearlescent_froglight",
  "beacon",
  "candle",
  "copper_bulb",
  "exposed_copper_bulb",
  "weathered_copper_bulb",
  "oxidized_copper_bulb",
]);

const EMISSION: Record<string, number> = {
  torch: 0.9,
  wall_torch: 0.9,
  soul_torch: 0.7,
  soul_wall_torch: 0.7,
  redstone_torch: 0.4,
  redstone_wall_torch: 0.4,
  lantern: 1,
  soul_lantern: 0.7,
  glowstone: 1,
  sea_lantern: 1,
  shroomlight: 1,
  redstone_lamp: 0,
  jack_o_lantern: 1,
  end_rod: 0.9,
  campfire: 1,
  soul_campfire: 0.7,
  ochre_froglight: 1,
  verdant_froglight: 1,
  pearlescent_froglight: 1,
  beacon: 1,
  lava: 1,
  magma_block: 0.3,
  candle: 0.5,
  crying_obsidian: 0.4,
};

const INTERIOR_IDS = new Set([
  "crafting_table",
  "furnace",
  "smoker",
  "blast_furnace",
  "chest",
  "trapped_chest",
  "ender_chest",
  "barrel",
  "bookshelf",
  "chiseled_bookshelf",
  "anvil",
  "chipped_anvil",
  "damaged_anvil",
  "cauldron",
  "water_cauldron",
  "lava_cauldron",
  "powder_snow_cauldron",
  "loom",
  "lectern",
  "enchanting_table",
  "brewing_stand",
  "cartography_table",
  "fletching_table",
  "smithing_table",
  "stonecutter",
  "grindstone",
  "composter",
  "jukebox",
  "note_block",
  "respawn_anchor",
  "crafter",
  "decorated_pot",
]);

const PLANT_IDS = new Set([
  "short_grass",
  "grass",
  "fern",
  "dead_bush",
  "dandelion",
  "poppy",
  "blue_orchid",
  "allium",
  "azure_bluet",
  "red_tulip",
  "orange_tulip",
  "white_tulip",
  "pink_tulip",
  "oxeye_daisy",
  "cornflower",
  "lily_of_the_valley",
  "wither_rose",
  "torchflower",
  "sunflower",
  "lilac",
  "rose_bush",
  "peony",
  "tall_grass",
  "large_fern",
  "brown_mushroom",
  "red_mushroom",
  "sweet_berry_bush",
  "cobweb",
  "sugar_cane",
  "bamboo",
  "bamboo_sapling",
  "pink_petals",
  "red_shrub",
  "shelf_mushroom",
  "seagrass",
  "tall_seagrass",
  "kelp",
  "kelp_plant",
  "azalea",
  "flowering_azalea",
  "crimson_fungus",
  "warped_fungus",
  "crimson_roots",
  "warped_roots",
  "nether_sprouts",
  "hanging_roots",
  "spore_blossom",
  "pitcher_plant",
  "open_eyeblossom",
  "closed_eyeblossom",
  "leaf_litter",
  "wildflowers",
  "bush",
  "firefly_bush",
  "short_dry_grass",
  "tall_dry_grass",
  "cactus_flower",
]);

const CROP_IDS = new Set(["wheat", "carrots", "potatoes", "beetroots", "nether_wart", "torchflower_crop"]);

const GRAVITY_IDS = new Set([
  "sand",
  "red_sand",
  "gravel",
  "suspicious_sand",
  "suspicious_gravel",
  "anvil",
  "chipped_anvil",
  "damaged_anvil",
  "dragon_egg",
  "pointed_dripstone",
]);

const UNPLACEABLE = new Set([
  "air",
  "cave_air",
  "void_air",
  "structure_void",
  "barrier",
  "light",
  "moving_piston",
  "piston_head",
  "fire",
  "soul_fire",
  "bubble_column",
  "end_portal",
  "nether_portal",
  "end_gateway",
]);

function woodOf(s: string): WoodType | null {
  for (const w of WOOD_TYPES) if (s.startsWith(w + "_") || s.startsWith("stripped_" + w + "_")) return w;
  return null;
}

function look(material: string): TexDef {
  return materialLook(material);
}

function uniform(t: TexDef): BlockInfo["tex"] {
  return { top: t, side: t, bottom: t };
}

const cache = new Map<string, BlockInfo>();

/** Resolves block knowledge for a fully-qualified block id (cached). */
export function blockInfo(name: string): BlockInfo {
  let info = cache.get(name);
  if (!info) {
    info = resolve(name);
    cache.set(name, info);
  }
  return info;
}

export function blockInfoOf(s: BlockState): BlockInfo {
  return blockInfo(s.name);
}

function base(id: string, material: string, partial: Partial<BlockInfo> = {}): BlockInfo {
  const t = look(material);
  return {
    id,
    shape: "cube",
    render: "opaque",
    full: true,
    tex: uniform(t),
    color: t.color,
    emissive: 0,
    hint: "structural",
    attach: "none",
    gravity: false,
    material,
    ...partial,
  };
}

function resolve(name: string): BlockInfo {
  const s = shortId(name);
  const material = canonicalMaterial(name);
  const mk = (p: Partial<BlockInfo> = {}) => base(name, material, p);
  const emissive = EMISSION[s] ?? (s.endsWith("_candle") ? 0.5 : 0);
  const light = LIGHT_IDS.has(s) || s.endsWith("_candle") || s.endsWith("copper_bulb");

  if (UNPLACEABLE.has(s)) return mk({ shape: "air", render: "none", full: false, hint: "decor" });

  /* ---------- liquids ---------- */
  if (s === "water" || s === "lava") {
    return mk({ shape: "liquid", render: s === "water" ? "translucent" : "opaque", full: false, hint: "liquid", emissive });
  }

  /* ---------- logs & pillars (axis aware) ---------- */
  const wood = woodOf(s);
  if (/_(log|wood|stem|hyphae)$/.test(s) || s === "bamboo_block" || s === "stripped_bamboo_block") {
    const t = look(material);
    const isWood = /_(wood|hyphae)$/.test(s);
    const stripped = s.startsWith("stripped_");
    const w = wood ? WOOD[wood] : null;
    const ringBase = w ? (stripped ? w.stripped : w.planks) : t.color;
    const top: TexDef = isWood ? t : { pattern: "log_top", color: ringBase, accent: t.color };
    return mk({ tex: { top, bottom: top, side: t }, hint: "frame" });
  }
  if (s.endsWith("_pillar") || s === "basalt" || s === "polished_basalt") {
    const t = look(material);
    const top: TexDef = { pattern: "pillar_top", color: t.color, accent: t.accent ?? shade(t.color, 0.8) };
    return mk({ tex: { top, bottom: top, side: t }, hint: "frame" });
  }
  if (s === "hay_block" || s === "straw_block") {
    const t = look(material);
    const top: TexDef = { pattern: "pillar_top", color: t.color, accent: t.accent ?? shade(t.color, 0.8) };
    return mk({ tex: { top, bottom: top, side: t }, hint: "decor" });
  }

  /* ---------- shaped variants ---------- */
  if (s.endsWith("_stairs")) return mk({ shape: "stairs", full: false });
  if (s.endsWith("_slab")) return mk({ shape: "slab", full: false });
  if (s.endsWith("_fence_gate")) return mk({ shape: "fence_gate", full: false, render: "cutout", hint: "opening" });
  if (s.endsWith("_fence")) return mk({ shape: "fence", full: false, hint: "fence" });
  if (
    s.endsWith("_wall") &&
    !s.endsWith("_wall_torch") &&
    !s.endsWith("_wall_sign") &&
    !s.endsWith("_wall_banner") &&
    !s.endsWith("_wall_head") &&
    !s.endsWith("_wall_skull") &&
    !s.endsWith("_wall_fan") &&
    !s.endsWith("_wall_hanging_sign")
  ) {
    return mk({ shape: "wall", full: false, hint: "fence" });
  }
  if (s === "glass_pane" || s.endsWith("_stained_glass_pane")) {
    const t = look(material);
    return mk({ shape: "pane", full: false, render: "translucent", hint: "opening", tex: uniform(t) });
  }
  if (s === "iron_bars") return mk({ shape: "pane", full: false, render: "cutout", hint: "opening" });
  if (s.endsWith("_door")) {
    const t = look(material);
    const door: TexDef = { pattern: "door", color: t.color, accent: t.accent ?? shade(t.color, 0.75) };
    return mk({ shape: "door", full: false, render: "cutout", hint: "opening", attach: "below", tex: uniform(door) });
  }
  if (s.endsWith("_trapdoor")) {
    const t = look(material);
    const td: TexDef = { pattern: "trapdoor", color: t.color, accent: t.accent ?? shade(t.color, 0.75) };
    return mk({ shape: "trapdoor", full: false, render: "cutout", hint: "opening", tex: uniform(td) });
  }
  if (s.endsWith("_button")) return mk({ shape: "button", full: false, hint: "decor", attach: "face" });
  if (s === "lever") return base(name, "cobblestone", { shape: "button", full: false, hint: "decor", attach: "face" });
  if (s.endsWith("_pressure_plate")) return mk({ shape: "plate", full: false, hint: "decor", attach: "below" });
  if (s.endsWith("_wall_hanging_sign")) return mk({ shape: "wall_sign", full: false, hint: "decor", attach: "back" });
  if (s.endsWith("_hanging_sign")) return mk({ shape: "hanging_sign", full: false, hint: "decor", attach: "above" });
  if (s.endsWith("_wall_sign")) return mk({ shape: "wall_sign", full: false, hint: "decor", attach: "back" });
  if (s.endsWith("_sign")) return mk({ shape: "sign", full: false, hint: "decor", attach: "below" });
  if (s.endsWith("_wall_banner")) return mk({ shape: "wall_banner", full: false, hint: "decor", attach: "back", render: "cutout" });
  if (s.endsWith("_banner")) return mk({ shape: "banner", full: false, hint: "decor", attach: "below", render: "cutout" });
  if (s.endsWith("_carpet")) return mk({ shape: "carpet", full: false, hint: "interior", attach: "below" });
  if (s.endsWith("_bed")) {
    const t = look(material);
    const frame = WOOD.oak.planks;
    return mk({
      shape: "bed",
      full: false,
      hint: "interior",
      attach: "below",
      tex: { top: t, side: { pattern: "planks", color: frame, accent: shade(frame, 0.8) }, bottom: look("oak_planks") },
    });
  }
  if (s === "candle" || s.endsWith("_candle")) {
    return mk({ shape: "candle", full: false, hint: "light", attach: "below", emissive, render: "cutout" });
  }
  if (s.endsWith("_leaves")) return mk({ render: "cutout", hint: "nature" });
  if (s.endsWith("_shulker_box") || s === "shulker_box") return mk({ hint: "interior" });
  if (s.endsWith("_concrete_powder")) return mk({ gravity: true });
  if (s.endsWith("_head") || s.endsWith("_skull")) return mk({ shape: "head", full: false, hint: "decor" });
  if (s.startsWith("potted_") || s === "flower_pot") {
    return base(name, "flower_pot", { shape: "pot", full: false, hint: "decor", attach: "below" });
  }

  /* ---------- glass & translucent cubes ---------- */
  if (s === "glass" || s.endsWith("_stained_glass") || s === "tinted_glass") {
    return mk({ render: "translucent", hint: "opening", full: false });
  }
  if (s === "ice" || s === "slime_block" || s === "honey_block") return mk({ render: "translucent", full: false });

  /* ---------- explicit specials ---------- */
  switch (s) {
    case "grass_block": {
      const top = look("grass_block");
      const dirt = look("dirt");
      return mk({
        tex: { top, side: { pattern: "grass_side", color: dirt.color, accent: top.color }, bottom: dirt },
        hint: "nature",
      });
    }
    case "podzol":
    case "mycelium":
      return mk({ hint: "nature", tex: { top: look("podzol"), side: look("dirt"), bottom: look("dirt") } });
    case "dirt_path": {
      const top = look("dirt_path");
      return mk({ shape: "path", full: false, tex: { top, side: look("dirt"), bottom: look("dirt") } });
    }
    case "farmland":
      return mk({ shape: "path", full: false, hint: "nature", tex: { top: look("farmland"), side: look("dirt"), bottom: look("dirt") } });
    case "torch":
    case "soul_torch":
    case "redstone_torch":
      return mk({ shape: "torch", full: false, render: "cutout", hint: "light", attach: "below", emissive });
    case "wall_torch":
    case "soul_wall_torch":
    case "redstone_wall_torch":
      return mk({ shape: "wall_torch", full: false, render: "cutout", hint: "light", attach: "back", emissive });
    case "lantern":
    case "soul_lantern":
      return mk({ shape: "lantern", full: false, render: "cutout", hint: "light", attach: "hanging", emissive });
    case "campfire":
    case "soul_campfire":
      return mk({ shape: "campfire", full: false, render: "cutout", hint: "light", emissive });
    case "end_rod":
    case "lightning_rod":
      return mk({ shape: "rod", full: false, hint: s === "end_rod" ? "light" : "decor", emissive });
    case "chain":
    case "iron_chain":
      return base(name, "chain", { shape: "chain", full: false, render: "cutout", hint: "decor" });
    case "ladder":
      return mk({ shape: "ladder", full: false, render: "cutout", hint: "interior", attach: "back" });
    case "vine":
    case "glow_lichen":
    case "sculk_vein":
    case "resin_clump":
      return base(name, "oak_leaves", { shape: "vine", full: false, render: "cutout", hint: "nature" });
    case "scaffolding":
      return mk({ render: "cutout", hint: "decor", full: false });
    case "snow":
      return mk({ shape: "layer", full: false, hint: "nature", attach: "below" });
    case "rail":
    case "powered_rail":
    case "detector_rail":
    case "activator_rail":
      return mk({ shape: "rail", full: false, render: "cutout", hint: "decor", attach: "below" });
    case "redstone_wire":
      return base(name, "redstone_block", { shape: "rail", full: false, render: "cutout", hint: "decor", attach: "below" });
    case "chest":
    case "trapped_chest":
    case "ender_chest": {
      const t = look(material);
      return mk({ shape: "chest", full: false, hint: "interior", tex: uniform(t) });
    }
    case "barrel": {
      const side = look("barrel");
      const top: TexDef = { pattern: "barrel_top", color: side.color, accent: side.accent ?? 0 };
      return mk({ hint: "interior", tex: { top, side, bottom: top } });
    }
    case "crafting_table":
    case "cartography_table":
    case "fletching_table":
    case "smithing_table": {
      const side = look(material);
      const top: TexDef = { pattern: "crafting_top", color: side.color, accent: side.accent ?? 0 };
      return mk({ hint: "interior", tex: { top, side, bottom: look("oak_planks") } });
    }
    case "furnace":
    case "smoker":
    case "blast_furnace": {
      const side = look(material);
      const top: TexDef = { pattern: "smooth", color: shade(side.color, 1.05), accent: side.color };
      return mk({ hint: "interior", tex: { top, side, bottom: top } });
    }
    case "bookshelf":
    case "chiseled_bookshelf": {
      const side = look(material);
      return mk({ hint: "interior", tex: { top: look("oak_planks"), side, bottom: look("oak_planks") } });
    }
    case "anvil":
    case "chipped_anvil":
    case "damaged_anvil":
      return base(name, "anvil", { shape: "anvil", full: false, hint: "interior", gravity: true });
    case "lectern":
      return mk({ shape: "lectern", full: false, hint: "interior" });
    case "enchanting_table":
      return base(name, "obsidian", { shape: "table", full: false, hint: "interior" });
    case "stonecutter":
      return base(name, "stone", { shape: "table", full: false, hint: "interior" });
    case "cauldron":
    case "water_cauldron":
    case "lava_cauldron":
    case "powder_snow_cauldron":
      return base(name, "cauldron", { shape: "cauldron", full: false, hint: "interior" });
    case "hopper":
      return mk({ shape: "hopper", full: false, hint: "interior" });
    case "bell":
      return mk({ shape: "bell", full: false, hint: "decor" });
    case "cake":
      return base(name, "white_wool", { shape: "cake", full: false, hint: "interior", attach: "below" });
    case "brewing_stand":
    case "grindstone":
      return base(name, "cobblestone", { shape: "small", full: false, hint: "interior" });
    case "flower_pot":
      return base(name, "flower_pot", { shape: "pot", full: false, hint: "decor", attach: "below" });
    case "lily_pad":
      return base(name, "oak_leaves", { shape: "carpet", full: false, render: "cutout", hint: "nature" });
    case "cactus":
      return base(name, "moss_block", { hint: "nature", attach: "below" });
    case "pumpkin":
    case "carved_pumpkin":
    case "melon":
      return mk({ hint: "decor" });
    case "jack_o_lantern":
      return mk({ hint: "light", emissive });
    case "beehive":
    case "bee_nest":
      return mk({ hint: "decor" });
    case "glass":
      break;
    default:
      break;
  }

  if (PLANT_IDS.has(s) || s.endsWith("_sapling") || s.endsWith("_tulip")) {
    const leafLook = look("oak_leaves");
    const flower = /tulip|poppy|dandelion|orchid|allium|bluet|daisy|cornflower|lily|rose|peony|lilac|sunflower|petals|torchflower|blossom/.test(
      s,
    );
    const col = flower ? flowerColor(s) : leafLook.color;
    const t: TexDef = { pattern: flower ? "flower" : "plant", color: col, accent: leafLook.color };
    return base(name, material, {
      shape: "cross",
      full: false,
      render: "cutout",
      hint: "nature",
      attach: "below",
      tex: uniform(t),
      color: col,
    });
  }
  if (CROP_IDS.has(s)) {
    const t: TexDef = { pattern: "plant", color: 0x8db034, accent: 0x5f8a22 };
    return base(name, material, { shape: "crop", full: false, render: "cutout", hint: "nature", attach: "below", tex: uniform(t) });
  }

  const info = mk({ emissive, hint: light ? "light" : INTERIOR_IDS.has(s) ? "interior" : "structural" });
  if (GRAVITY_IDS.has(s)) info.gravity = true;
  return info;
}

function flowerColor(s: string): number {
  for (const c of DYE_COLORS) if (s.includes(c)) return lighten(dyeOf(c), 0.1);
  if (s.includes("poppy") || s.includes("rose")) return 0xc8201a;
  if (s.includes("dandelion") || s.includes("sunflower")) return 0xf2d22a;
  if (s.includes("orchid") || s.includes("cornflower")) return 0x3a7ad9;
  if (s.includes("allium") || s.includes("lilac")) return 0xb36ad9;
  if (s.includes("peony") || s.includes("petals") || s.includes("blossom")) return 0xeea0c8;
  return 0xeaeaea;
}

function dyeOf(c: (typeof DYE_COLORS)[number]): number {
  const t = materialLook(`${c}_wool`);
  return t.color;
}

/** True when the block is air-like (nothing to place). */
export function isAirLike(name: string): boolean {
  return blockInfo(name).shape === "air";
}

/** Can light/flood-fill pass through this block (used by the exterior detection). */
export function isPassable(name: string): boolean {
  const i = blockInfo(name);
  return (
    i.shape === "air" ||
    i.shape === "cross" ||
    i.shape === "crop" ||
    i.shape === "torch" ||
    i.shape === "rail" ||
    i.shape === "button" ||
    i.shape === "plate" ||
    i.shape === "vine" ||
    i.shape === "layer" ||
    i.shape === "carpet" ||
    i.shape === "liquid"
  );
}
