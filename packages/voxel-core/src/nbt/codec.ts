/**
 * Big-endian (Java Edition) NBT binary reader and writer.
 *
 * Strings use Java's "modified UTF-8": U+0000 is encoded as 0xC0 0x80 and supplementary
 * characters are encoded as two 3-byte surrogates.
 */
import { gunzipSync, gzipSync, unzlibSync } from "fflate";
import {
  NbtFormatError,
  TAG_ID,
  TAG_KIND,
  type NbtCompound,
  type NbtRoot,
  type NbtTag,
  type TagKind,
} from "./types";

const MAX_DEPTH = 512;

/* ---------------- modified UTF-8 ---------------- */

export function decodeMutf8(bytes: Uint8Array, start: number, end: number): string {
  let out = "";
  const codes: number[] = [];
  let i = start;
  while (i < end) {
    const a = bytes[i++]!;
    if (a < 0x80) {
      codes.push(a);
    } else if ((a & 0xe0) === 0xc0) {
      const b = bytes[i++]! & 0x3f;
      codes.push(((a & 0x1f) << 6) | b);
    } else if ((a & 0xf0) === 0xe0) {
      const b = bytes[i++]! & 0x3f;
      const c = bytes[i++]! & 0x3f;
      codes.push(((a & 0x0f) << 12) | (b << 6) | c);
    } else {
      // 4-byte sequences are not valid MUTF-8 but appear in files written by some tools.
      const b = bytes[i++]! & 0x3f;
      const c = bytes[i++]! & 0x3f;
      const d = bytes[i++]! & 0x3f;
      const cp = ((a & 0x07) << 18) | (b << 12) | (c << 6) | d;
      const v = cp - 0x10000;
      codes.push(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
    }
    if (codes.length >= 4096) {
      out += String.fromCharCode(...codes);
      codes.length = 0;
    }
  }
  return out + String.fromCharCode(...codes);
}

export function encodeMutf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i); // UTF-16 code unit; surrogates are encoded individually (Java behaviour)
    if (c !== 0 && c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return Uint8Array.from(out);
}

/* ---------------- reader ---------------- */

class Reader {
  private view: DataView;
  pos = 0;
  constructor(private bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  private need(n: number): void {
    if (this.pos + n > this.bytes.length) {
      throw new NbtFormatError(`Unexpected end of NBT data at offset ${this.pos} (need ${n} bytes)`);
    }
  }
  u8(): number {
    this.need(1);
    return this.bytes[this.pos++]!;
  }
  i8(): number {
    this.need(1);
    return this.view.getInt8(this.pos++);
  }
  i16(): number {
    this.need(2);
    const v = this.view.getInt16(this.pos);
    this.pos += 2;
    return v;
  }
  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.pos);
    this.pos += 2;
    return v;
  }
  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos);
    this.pos += 4;
    return v;
  }
  i64(): bigint {
    this.need(8);
    const v = this.view.getBigInt64(this.pos);
    this.pos += 8;
    return v;
  }
  f32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos);
    this.pos += 4;
    return v;
  }
  f64(): number {
    this.need(8);
    const v = this.view.getFloat64(this.pos);
    this.pos += 8;
    return v;
  }
  str(): string {
    const len = this.u16();
    this.need(len);
    const s = decodeMutf8(this.bytes, this.pos, this.pos + len);
    this.pos += len;
    return s;
  }
  length(): number {
    const n = this.i32();
    if (n < 0) return 0;
    return n;
  }

  payload(kind: TagKind, depth: number): NbtTag {
    if (depth > MAX_DEPTH) throw new NbtFormatError("NBT nesting too deep");
    switch (kind) {
      case "byte":
        return { kind, value: this.i8() };
      case "short":
        return { kind, value: this.i16() };
      case "int":
        return { kind, value: this.i32() };
      case "long":
        return { kind, value: this.i64() };
      case "float":
        return { kind, value: this.f32() };
      case "double":
        return { kind, value: this.f64() };
      case "byteArray": {
        const n = this.length();
        this.need(n);
        const value = new Int8Array(n);
        value.set(new Int8Array(this.bytes.buffer, this.bytes.byteOffset + this.pos, n));
        this.pos += n;
        return { kind, value };
      }
      case "string":
        return { kind, value: this.str() };
      case "list": {
        const elemId = this.u8();
        const elementKind = TAG_KIND[elemId];
        if (!elementKind) throw new NbtFormatError(`Unknown list element type ${elemId}`);
        const n = this.length();
        const value: NbtTag[] = new Array(n);
        if (n > 0 && elementKind === "end") throw new NbtFormatError("Non-empty list of TAG_End");
        for (let i = 0; i < n; i++) value[i] = this.payload(elementKind, depth + 1);
        return { kind, elementKind, value };
      }
      case "compound": {
        const value = new Map<string, NbtTag>();
        for (;;) {
          const id = this.u8();
          if (id === 0) break;
          const k = TAG_KIND[id];
          if (!k) throw new NbtFormatError(`Unknown tag type ${id} at offset ${this.pos - 1}`);
          const name = this.str();
          value.set(name, this.payload(k, depth + 1));
        }
        return { kind, value };
      }
      case "intArray": {
        const n = this.length();
        this.need(n * 4);
        const value = new Int32Array(n);
        for (let i = 0; i < n; i++) value[i] = this.i32();
        return { kind, value };
      }
      case "longArray": {
        const n = this.length();
        this.need(n * 8);
        const value = new BigInt64Array(n);
        for (let i = 0; i < n; i++) value[i] = this.i64();
        return { kind, value };
      }
      case "end":
        throw new NbtFormatError("Unexpected TAG_End");
    }
  }
}

/** Parses uncompressed big-endian NBT. The root must be a compound. */
export function readNbt(bytes: Uint8Array): NbtRoot {
  const r = new Reader(bytes);
  const id = r.u8();
  if (id !== TAG_ID.compound) throw new NbtFormatError(`Root tag must be a compound (got type ${id})`);
  const name = r.str();
  const tag = r.payload("compound", 0) as NbtCompound;
  return { name, tag };
}

/* ---------------- writer ---------------- */

class Writer {
  private buf = new Uint8Array(1 << 16);
  private view = new DataView(this.buf.buffer);
  pos = 0;
  private ensure(n: number): void {
    if (this.pos + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.pos + n) size *= 2;
    const nb = new Uint8Array(size);
    nb.set(this.buf.subarray(0, this.pos));
    this.buf = nb;
    this.view = new DataView(nb.buffer);
  }
  u8(v: number): void {
    this.ensure(1);
    this.buf[this.pos++] = v & 0xff;
  }
  i8(v: number): void {
    this.ensure(1);
    this.view.setInt8(this.pos++, v);
  }
  i16(v: number): void {
    this.ensure(2);
    this.view.setInt16(this.pos, v);
    this.pos += 2;
  }
  u16(v: number): void {
    this.ensure(2);
    this.view.setUint16(this.pos, v);
    this.pos += 2;
  }
  i32(v: number): void {
    this.ensure(4);
    this.view.setInt32(this.pos, v);
    this.pos += 4;
  }
  i64(v: bigint): void {
    this.ensure(8);
    this.view.setBigInt64(this.pos, BigInt.asIntN(64, v));
    this.pos += 8;
  }
  f32(v: number): void {
    this.ensure(4);
    this.view.setFloat32(this.pos, v);
    this.pos += 4;
  }
  f64(v: number): void {
    this.ensure(8);
    this.view.setFloat64(this.pos, v);
    this.pos += 8;
  }
  bytes(b: Uint8Array): void {
    this.ensure(b.length);
    this.buf.set(b, this.pos);
    this.pos += b.length;
  }
  str(s: string): void {
    const e = encodeMutf8(s);
    if (e.length > 0xffff) throw new NbtFormatError("String too long for NBT");
    this.u16(e.length);
    this.bytes(e);
  }
  payload(t: NbtTag): void {
    switch (t.kind) {
      case "byte":
        return this.i8(t.value);
      case "short":
        return this.i16(t.value);
      case "int":
        return this.i32(t.value);
      case "long":
        return this.i64(t.value);
      case "float":
        return this.f32(t.value);
      case "double":
        return this.f64(t.value);
      case "byteArray":
        this.i32(t.value.length);
        return this.bytes(new Uint8Array(t.value.buffer, t.value.byteOffset, t.value.length));
      case "string":
        return this.str(t.value);
      case "list": {
        const ek = t.value.length === 0 ? t.elementKind : t.value[0]!.kind;
        this.u8(TAG_ID[ek]);
        this.i32(t.value.length);
        for (const e of t.value) {
          if (e.kind !== ek) throw new NbtFormatError(`Mixed list element types (${ek} and ${e.kind})`);
          this.payload(e);
        }
        return;
      }
      case "compound":
        for (const [k, v] of t.value) {
          this.u8(TAG_ID[v.kind]);
          this.str(k);
          this.payload(v);
        }
        return this.u8(0);
      case "intArray":
        this.i32(t.value.length);
        for (const v of t.value) this.i32(v);
        return;
      case "longArray":
        this.i32(t.value.length);
        for (const v of t.value) this.i64(v);
        return;
    }
  }
  result(): Uint8Array {
    return this.buf.slice(0, this.pos);
  }
}

/** Serialises a root compound to uncompressed big-endian NBT. */
export function writeNbt(root: NbtRoot): Uint8Array {
  const w = new Writer();
  w.u8(TAG_ID.compound);
  w.str(root.name);
  w.payload(root.tag);
  return w.result();
}

/* ---------------- compression helpers ---------------- */

export function isGzip(b: Uint8Array): boolean {
  return b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;
}

function isZlib(b: Uint8Array): boolean {
  return b.length > 2 && b[0] === 0x78 && (b[1] === 0x01 || b[1] === 0x5e || b[1] === 0x9c || b[1] === 0xda);
}

/** Decompresses gzip/zlib data if needed; returns the input otherwise. */
export function maybeDecompress(b: Uint8Array): Uint8Array {
  if (isGzip(b)) return gunzipSync(b);
  if (isZlib(b)) return unzlibSync(b);
  return b;
}

export function readNbtFile(bytes: Uint8Array): NbtRoot {
  return readNbt(maybeDecompress(bytes));
}

export function writeNbtFile(root: NbtRoot, gzip = true): Uint8Array {
  const raw = writeNbt(root);
  return gzip ? gzipSync(raw, { level: 6, mtime: 0 }) : raw;
}
