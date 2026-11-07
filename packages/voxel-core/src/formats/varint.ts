/** Unsigned LEB128 varints as used by the Sponge schematic format. */

export function encodeVarints(values: ArrayLike<number>): Uint8Array {
  let size = 0;
  for (let i = 0; i < values.length; i++) {
    let v = values[i]! >>> 0;
    do {
      size++;
      v >>>= 7;
    } while (v !== 0);
  }
  const out = new Uint8Array(size);
  let o = 0;
  for (let i = 0; i < values.length; i++) {
    let v = values[i]! >>> 0;
    while (v >= 0x80) {
      out[o++] = (v & 0x7f) | 0x80;
      v >>>= 7;
    }
    out[o++] = v;
  }
  return out;
}

/** Decodes exactly `count` varints (throws if data is truncated). */
export function decodeVarints(bytes: Uint8Array | Int8Array, count: number): Uint32Array {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length);
  const out = new Uint32Array(count);
  let i = 0;
  let p = 0;
  while (i < count) {
    let value = 0;
    let shift = 0;
    for (;;) {
      if (p >= b.length) throw new Error(`Varint data truncated: decoded ${i} of ${count} values`);
      const byte = b[p++]!;
      value |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
      if (shift > 28) throw new Error("Varint too long");
    }
    out[i++] = value >>> 0;
  }
  return out;
}
