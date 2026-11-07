/** Test fixtures created on the fly (our own data only — no third-party schematics or textures). */
import { deflateSync } from "node:zlib";
import { zipSync } from "fflate";

/** Minimal PNG encoder (RGBA, 8-bit). */
export function png(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number, number],
): Uint8Array {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (width * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

/** A tiny resource pack with two self-made textures (stripes and checkers). */
export function testResourcePack(): Uint8Array {
  const stripes = png(16, 16, (_x, y) => (y % 4 < 2 ? [200, 40, 40, 255] : [250, 220, 60, 255]));
  const checks = png(16, 16, (x, y) =>
    ((x >> 2) + (y >> 2)) % 2 ? [30, 30, 30, 255] : [240, 240, 240, 255],
  );
  return zipSync({
    "pack.mcmeta": new TextEncoder().encode(
      JSON.stringify({ pack: { pack_format: 1, description: "test" } }),
    ),
    "assets/minecraft/textures/block/oak_planks.png": stripes,
    "assets/minecraft/textures/block/cobblestone.png": checks,
  });
}
