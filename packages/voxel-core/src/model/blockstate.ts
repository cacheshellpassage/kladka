/** Block-state helpers: parsing and canonical formatting of `namespace:id[key=value,...]`. */

export type GameId = "minecraft-java";

export interface BlockState {
  /** Fully qualified id, e.g. `minecraft:oak_stairs`. */
  name: string;
  /** Block-state properties, e.g. `{ facing: "north", half: "bottom" }`. */
  props: Readonly<Record<string, string>>;
}

export const AIR: BlockState = Object.freeze({ name: "minecraft:air", props: Object.freeze({}) });

const AIR_IDS = new Set(["minecraft:air", "minecraft:cave_air", "minecraft:void_air"]);

export function isAirName(name: string): boolean {
  return AIR_IDS.has(name);
}

/** Adds the default `minecraft:` namespace if missing. */
export function qualify(id: string): string {
  return id.includes(":") ? id : `minecraft:${id}`;
}

/** Strips the namespace when it is `minecraft:`. */
export function shortId(name: string): string {
  return name.startsWith("minecraft:") ? name.slice(10) : name;
}

/** Canonical string key with sorted properties (stable palette identity). */
export function stateKey(s: BlockState): string {
  const keys = Object.keys(s.props);
  if (keys.length === 0) return s.name;
  keys.sort();
  return `${s.name}[${keys.map((k) => `${k}=${s.props[k]}`).join(",")}]`;
}

/** Parses `minecraft:oak_stairs[facing=north,half=bottom]` (namespace optional). */
export function parseState(str: string): BlockState {
  const s = str.trim();
  const br = s.indexOf("[");
  if (br < 0) return { name: qualify(s), props: {} };
  const name = qualify(s.slice(0, br));
  const end = s.lastIndexOf("]");
  const inner = s.slice(br + 1, end < 0 ? s.length : end);
  const props: Record<string, string> = {};
  for (const part of inner.split(",")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    props[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return { name, props };
}

export function state(id: string, props: Record<string, string> = {}): BlockState {
  return { name: qualify(id), props };
}

export function withProps(s: BlockState, patch: Record<string, string | undefined>): BlockState {
  const props: Record<string, string> = { ...s.props };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete props[k];
    else props[k] = v;
  }
  return { name: s.name, props };
}
