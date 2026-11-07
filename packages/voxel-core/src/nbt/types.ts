/**
 * Typed in-memory representation of Named Binary Tag (NBT) data.
 *
 * Every tag keeps its exact NBT type so that files can be round-tripped without loss
 * (e.g. a Short stays a Short, an empty List keeps its element type).
 * Compounds use `Map` so that key order is preserved even for integer-like keys.
 */

export type TagKind =
  | "end"
  | "byte"
  | "short"
  | "int"
  | "long"
  | "float"
  | "double"
  | "byteArray"
  | "string"
  | "list"
  | "compound"
  | "intArray"
  | "longArray";

export const TAG_ID: Record<TagKind, number> = {
  end: 0,
  byte: 1,
  short: 2,
  int: 3,
  long: 4,
  float: 5,
  double: 6,
  byteArray: 7,
  string: 8,
  list: 9,
  compound: 10,
  intArray: 11,
  longArray: 12,
};

export const TAG_KIND: readonly TagKind[] = [
  "end",
  "byte",
  "short",
  "int",
  "long",
  "float",
  "double",
  "byteArray",
  "string",
  "list",
  "compound",
  "intArray",
  "longArray",
];

export interface NbtByte {
  kind: "byte";
  value: number;
}
export interface NbtShort {
  kind: "short";
  value: number;
}
export interface NbtInt {
  kind: "int";
  value: number;
}
export interface NbtLong {
  kind: "long";
  value: bigint;
}
export interface NbtFloat {
  kind: "float";
  value: number;
}
export interface NbtDouble {
  kind: "double";
  value: number;
}
export interface NbtByteArray {
  kind: "byteArray";
  value: Int8Array;
}
export interface NbtString {
  kind: "string";
  value: string;
}
export interface NbtList {
  kind: "list";
  elementKind: TagKind;
  value: NbtTag[];
}
export interface NbtCompound {
  kind: "compound";
  value: Map<string, NbtTag>;
}
export interface NbtIntArray {
  kind: "intArray";
  value: Int32Array;
}
export interface NbtLongArray {
  kind: "longArray";
  value: BigInt64Array;
}

export type NbtTag =
  | NbtByte
  | NbtShort
  | NbtInt
  | NbtLong
  | NbtFloat
  | NbtDouble
  | NbtByteArray
  | NbtString
  | NbtList
  | NbtCompound
  | NbtIntArray
  | NbtLongArray;

/** A named root tag as stored in a file. */
export interface NbtRoot {
  name: string;
  tag: NbtCompound;
}

/* ---------- constructors ---------- */

export const nbt = {
  byte: (value: number): NbtByte => ({ kind: "byte", value }),
  short: (value: number): NbtShort => ({ kind: "short", value }),
  int: (value: number): NbtInt => ({ kind: "int", value }),
  long: (value: bigint | number): NbtLong => ({ kind: "long", value: BigInt(value) }),
  float: (value: number): NbtFloat => ({ kind: "float", value }),
  double: (value: number): NbtDouble => ({ kind: "double", value }),
  byteArray: (value: Int8Array | Uint8Array): NbtByteArray => ({
    kind: "byteArray",
    value: value instanceof Int8Array ? value : new Int8Array(value.buffer, value.byteOffset, value.length),
  }),
  string: (value: string): NbtString => ({ kind: "string", value }),
  list: (elementKind: TagKind, value: NbtTag[]): NbtList => ({ kind: "list", elementKind, value }),
  compound: (entries?: Record<string, NbtTag> | Map<string, NbtTag>): NbtCompound => ({
    kind: "compound",
    value: entries instanceof Map ? entries : new Map(Object.entries(entries ?? {})),
  }),
  intArray: (value: Int32Array | number[]): NbtIntArray => ({
    kind: "intArray",
    value: value instanceof Int32Array ? value : Int32Array.from(value),
  }),
  longArray: (value: BigInt64Array | bigint[]): NbtLongArray => ({
    kind: "longArray",
    value: value instanceof BigInt64Array ? value : BigInt64Array.from(value),
  }),
};

/* ---------- typed accessors (throw NbtFormatError with a readable path) ---------- */

export class NbtFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NbtFormatError";
  }
}

export function get(c: NbtCompound, key: string): NbtTag | undefined {
  return c.value.get(key);
}

function expectKind<K extends TagKind>(
  c: NbtCompound,
  key: string,
  kinds: readonly K[],
): Extract<NbtTag, { kind: K }> {
  const t = c.value.get(key);
  if (!t) throw new NbtFormatError(`Missing tag "${key}"`);
  if (!(kinds as readonly TagKind[]).includes(t.kind)) {
    throw new NbtFormatError(`Tag "${key}" has type ${t.kind}, expected ${kinds.join(" | ")}`);
  }
  return t as Extract<NbtTag, { kind: K }>;
}

/** Reads any integral numeric tag (byte/short/int) as a JS number. */
export function getNumber(c: NbtCompound, key: string): number {
  const t = expectKind(c, key, ["byte", "short", "int", "long", "float", "double"] as const);
  return typeof t.value === "bigint" ? Number(t.value) : t.value;
}

export function getNumberOr(c: NbtCompound, key: string, fallback: number): number {
  return c.value.has(key) ? getNumber(c, key) : fallback;
}

export function getString(c: NbtCompound, key: string): string {
  return expectKind(c, key, ["string"] as const).value;
}

export function getStringOr(c: NbtCompound, key: string, fallback: string): string {
  const t = c.value.get(key);
  return t && t.kind === "string" ? t.value : fallback;
}

export function getCompound(c: NbtCompound, key: string): NbtCompound {
  return expectKind(c, key, ["compound"] as const);
}

export function getOptCompound(c: NbtCompound, key: string): NbtCompound | undefined {
  const t = c.value.get(key);
  return t && t.kind === "compound" ? t : undefined;
}

export function getList(c: NbtCompound, key: string): NbtList {
  return expectKind(c, key, ["list"] as const);
}

export function getOptList(c: NbtCompound, key: string): NbtList | undefined {
  const t = c.value.get(key);
  return t && t.kind === "list" ? t : undefined;
}

/** Reads an int-array-like tag (IntArray or List of ints) as number[]. */
export function getIntVector(c: NbtCompound, key: string): number[] {
  const t = c.value.get(key);
  if (!t) throw new NbtFormatError(`Missing tag "${key}"`);
  if (t.kind === "intArray") return Array.from(t.value);
  if (t.kind === "list") {
    return t.value.map((e) => {
      if (
        e.kind === "int" ||
        e.kind === "short" ||
        e.kind === "byte" ||
        e.kind === "double" ||
        e.kind === "float"
      )
        return e.value;
      throw new NbtFormatError(`List "${key}" contains ${e.kind}`);
    });
  }
  throw new NbtFormatError(`Tag "${key}" has type ${t.kind}, expected int vector`);
}

/** Converts a plain compound of string tags into a record (used for block-state properties). */
export function compoundToStringRecord(c: NbtCompound | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!c) return out;
  for (const [k, v] of c.value) {
    if (v.kind === "string") out[k] = v.value;
    else if (v.kind === "byte" || v.kind === "short" || v.kind === "int") out[k] = String(v.value);
  }
  return out;
}

export function stringRecordToCompound(rec: Record<string, string>): NbtCompound {
  const m = new Map<string, NbtTag>();
  for (const k of Object.keys(rec).sort()) m.set(k, nbt.string(rec[k]!));
  return { kind: "compound", value: m };
}

/** Deep structural equality, used by tests and round-trip checks. */
export function nbtEquals(a: NbtTag, b: NbtTag): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "byte":
    case "short":
    case "int":
    case "string":
      return a.value === (b as typeof a).value;
    case "float":
    case "double":
      return Object.is(a.value, (b as typeof a).value) || a.value === (b as typeof a).value;
    case "long":
      return a.value === (b as NbtLong).value;
    case "byteArray":
    case "intArray":
    case "longArray": {
      const bv = (b as typeof a).value;
      if (a.value.length !== bv.length) return false;
      for (let i = 0; i < a.value.length; i++) if (a.value[i] !== bv[i]) return false;
      return true;
    }
    case "list": {
      const bl = b as NbtList;
      if (a.value.length !== bl.value.length) return false;
      if (a.value.length > 0 && a.elementKind !== bl.elementKind) return false;
      return a.value.every((t, i) => nbtEquals(t, bl.value[i]!));
    }
    case "compound": {
      const bc = b as NbtCompound;
      if (a.value.size !== bc.value.size) return false;
      for (const [k, v] of a.value) {
        const o = bc.value.get(k);
        if (!o || !nbtEquals(v, o)) return false;
      }
      return true;
    }
  }
}

/** Converts NBT into plain JSON-friendly data (lossy for types; for display and debugging). */
export function nbtToPlain(t: NbtTag): unknown {
  switch (t.kind) {
    case "long":
      return t.value.toString();
    case "byteArray":
    case "intArray":
      return Array.from(t.value);
    case "longArray":
      return Array.from(t.value, (v) => v.toString());
    case "list":
      return t.value.map(nbtToPlain);
    case "compound": {
      const o: Record<string, unknown> = {};
      for (const [k, v] of t.value) o[k] = nbtToPlain(v);
      return o;
    }
    default:
      return t.value;
  }
}
