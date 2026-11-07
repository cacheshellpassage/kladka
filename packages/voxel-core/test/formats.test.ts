import { describe, expect, it } from "vitest";
import * as pnbt from "prismarine-nbt";
import { gunzipSync } from "fflate";
import {
  decodeVarints,
  encodeVarints,
  exportKBuild,
  exportModel,
  importBytes,
  litematicaBits,
  nbt,
  packBits,
  readNbtFile,
  unpackBits,
  writeNbtFile,
  getCompound,
  getNumber,
  MC_DATA_VERSION,
  type NbtCompound,
} from "../src";
import { cottage, sameBlocks } from "./fixtures";

/** Line-by-line port of Litematica's LitematicaBitArray#setAt (Java long semantics). */
function javaSetAt(arr: BigInt64Array, bits: number, index: number, value: number): void {
  const L = (v: bigint) => BigInt.asIntN(64, v);
  const max = (1n << BigInt(bits)) - 1n;
  const startOffset = BigInt(index) * BigInt(bits);
  const startArr = Number(startOffset >> 6n);
  const endArr = Number(((BigInt(index) + 1n) * BigInt(bits) - 1n) >> 6n);
  const startBit = Number(startOffset & 0x3fn);
  arr[startArr] = L(
    (arr[startArr]! & ~L(max << BigInt(startBit))) | L((BigInt(value) & max) << BigInt(startBit)),
  );
  if (startArr !== endArr) {
    const endOffset = 64 - startBit;
    const j1 = bits - endOffset;
    const unsigned = BigInt.asUintN(64, arr[endArr]!);
    arr[endArr] = L(((unsigned >> BigInt(j1)) << BigInt(j1)) | ((BigInt(value) & max) >> BigInt(endOffset)));
  }
}

describe("varints", () => {
  it("round-trips including multi-byte values", () => {
    const v = [0, 1, 127, 128, 255, 300, 16384, 65535];
    expect(Array.from(decodeVarints(encodeVarints(v), v.length))).toEqual(v);
    expect([...encodeVarints([300])]).toEqual([0xac, 0x02]);
  });
  it("throws on truncated data", () => {
    expect(() => decodeVarints(Uint8Array.from([0x80]), 1)).toThrow();
  });
});

describe("Litematica bit packing", () => {
  it("computes bits like Litematica", () => {
    expect(litematicaBits(1)).toBe(2);
    expect(litematicaBits(4)).toBe(2);
    expect(litematicaBits(5)).toBe(3);
    expect(litematicaBits(75)).toBe(7);
    expect(litematicaBits(256)).toBe(8);
    expect(litematicaBits(257)).toBe(9);
  });
  it("matches a hand-computed vector", () => {
    const packed = packBits([1, 2, 3, 0, 1], 2);
    expect(packed.length).toBe(1);
    expect(packed[0]).toBe(313n);
  });
  it("matches the Java algorithm bit-for-bit, including straddling entries", () => {
    for (const bits of [2, 3, 5, 7, 9, 13]) {
      const n = 211;
      const values = Array.from({ length: n }, (_, i) => (i * 7919 + 13) % (1 << bits));
      const ref = new BigInt64Array(Math.ceil((n * bits) / 64));
      values.forEach((v, i) => javaSetAt(ref, bits, i, v));
      const ours = packBits(values, bits);
      expect(Array.from(ours)).toEqual(Array.from(ref));
      expect(Array.from(unpackBits(ours, bits, n))).toEqual(values);
    }
  });
});

describe("format round trips", () => {
  const m = cottage();
  for (const format of ["schem", "schem-v2", "litematic", "nbt"] as const) {
    it(`${format}: export → import keeps blocks, states and block entities`, () => {
      const out = exportModel(m, format);
      const res = importBytes(out.bytes, `test.${out.extension}`);
      expect(res.warnings).toEqual([]);
      expect(res.model.dataVersion).toBe(MC_DATA_VERSION);
      expect(sameBlocks(res.model, m)).toBe(true);
      const be = res.model.blockEntities.get(m.index(3, 1, 3));
      expect(be?.id).toBe("minecraft:chest");
      expect(be?.data.value.get("CustomName")).toEqual(nbt.string('"Tools"'));
      const again = exportModel(res.model, format);
      expect(importBytes(again.bytes, `x.${again.extension}`).model.countBlocks()).toBe(m.countBlocks());
    });
  }

  it("kbuild round trip keeps roles", () => {
    const mm = m.clone();
    mm.roles = new Uint8Array(mm.volume).fill(3);
    const bytes = exportKBuild(mm, {
      id: "t",
      title: { ru: "т", en: "t" },
      author: "me",
      license: "CC0-1.0",
      createdAt: "2026-11-07",
      style: "rustic",
      tags: [],
    });
    const res = importBytes(bytes, "t.kbuild");
    expect(res.format).toBe("kbuild");
    expect(sameBlocks(res.model, mm)).toBe(true);
    expect(res.model.roles?.[5]).toBe(3);
    expect(res.meta?.license).toBe("CC0-1.0");
  });
});

describe("output structure follows the specs", () => {
  const m = cottage();
  it("Sponge v3: root '' → Schematic compound with Blocks container", () => {
    const root = readNbtFile(exportModel(m, "schem").bytes);
    expect(root.name).toBe("");
    const s = getCompound(root.tag, "Schematic");
    expect(getNumber(s, "Version")).toBe(3);
    expect(s.value.get("Width")?.kind).toBe("short");
    expect(s.value.get("Offset")?.kind).toBe("intArray");
    const blocks = getCompound(s, "Blocks");
    expect(blocks.value.get("Palette")?.kind).toBe("compound");
    expect(blocks.value.get("Data")?.kind).toBe("byteArray");
    const be = blocks.value.get("BlockEntities");
    expect(be?.kind).toBe("list");
    const first = be?.kind === "list" ? (be.value[0] as NbtCompound) : undefined;
    expect(first?.value.get("Pos")?.kind).toBe("intArray");
    expect(first?.value.get("Data")?.kind).toBe("compound");
  });
  it("Sponge v2: root named Schematic with flat palette and PaletteMax", () => {
    const root = readNbtFile(exportModel(m, "schem-v2").bytes);
    expect(root.name).toBe("Schematic");
    expect(getNumber(root.tag, "Version")).toBe(2);
    expect(getNumber(root.tag, "PaletteMax")).toBe(m.palette.length);
    expect(root.tag.value.get("BlockData")?.kind).toBe("byteArray");
  });
  it("Litematic: Version 7, metadata, region with long array of the right length", () => {
    const root = readNbtFile(exportModel(m, "litematic").bytes);
    expect(getNumber(root.tag, "Version")).toBe(7);
    expect(getNumber(root.tag, "SubVersion")).toBe(1);
    expect(getNumber(root.tag, "MinecraftDataVersion")).toBe(MC_DATA_VERSION);
    const meta = getCompound(root.tag, "Metadata");
    expect(getNumber(meta, "TotalVolume")).toBe(m.volume);
    expect(getNumber(meta, "TotalBlocks")).toBe(m.countBlocks());
    const regions = getCompound(root.tag, "Regions");
    const region = [...regions.value.values()][0] as NbtCompound;
    const bs = region.value.get("BlockStates");
    const bits = litematicaBits(m.palette.length);
    expect(bs?.kind === "longArray" && bs.value.length).toBe(Math.ceil((m.volume * bits) / 64));
  });
  it("Structure .nbt: size list, palette, blocks with state/pos", () => {
    const root = readNbtFile(exportModel(m, "nbt").bytes);
    const size = root.tag.value.get("size");
    expect(size?.kind === "list" && size.elementKind).toBe("int");
    const blocks = root.tag.value.get("blocks");
    expect(blocks?.kind === "list" && blocks.value.length).toBe(m.volume);
  });
  it("our gzip output is readable by prismarine-nbt", async () => {
    const bytes = exportModel(m, "litematic").bytes;
    const { parsed } = await pnbt.parse(Buffer.from(gunzipSync(bytes)));
    const simple = pnbt.simplify(parsed) as {
      Version: number;
      Regions: Record<string, { Size: { x: number } }>;
    };
    expect(simple.Version).toBe(7);
    expect(Object.values(simple.Regions)[0]?.Size.x).toBe(m.size.x);
  });
});

describe("Litematica import edge cases", () => {
  it("merges multiple regions with negative sizes", () => {
    const region = (
      px: number,
      py: number,
      pz: number,
      sx: number,
      sy: number,
      sz: number,
      block: string,
    ) => {
      const vol = Math.abs(sx * sy * sz);
      const vals = new Array<number>(vol).fill(1);
      return nbt.compound({
        Position: nbt.compound({ x: nbt.int(px), y: nbt.int(py), z: nbt.int(pz) }),
        Size: nbt.compound({ x: nbt.int(sx), y: nbt.int(sy), z: nbt.int(sz) }),
        BlockStatePalette: nbt.list("compound", [
          nbt.compound({ Name: nbt.string("minecraft:air") }),
          nbt.compound({ Name: nbt.string(block) }),
        ]),
        BlockStates: nbt.longArray(packBits(vals, 2)),
        TileEntities: nbt.list("compound", []),
        Entities: nbt.list("compound", []),
        PendingBlockTicks: nbt.list("compound", []),
        PendingFluidTicks: nbt.list("compound", []),
      });
    };
    const root = {
      name: "",
      tag: nbt.compound({
        MinecraftDataVersion: nbt.int(3700),
        Version: nbt.int(6),
        Metadata: nbt.compound({
          Name: nbt.string("multi"),
          Author: nbt.string("t"),
          Description: nbt.string(""),
        }),
        Regions: nbt.compound({
          a: region(0, 0, 0, 2, 1, 2, "minecraft:stone"),
          // negative size: spans x 3..5 (pos 5, size -3)
          b: region(5, 1, 0, -3, 1, 1, "minecraft:oak_planks"),
        }),
      }),
    };
    const res = importBytes(writeNbtFile(root), "multi.litematic");
    const mm = res.model;
    expect(mm.size).toEqual({ x: 6, y: 2, z: 2 });
    expect(mm.get(0, 0, 0).name).toBe("minecraft:stone");
    expect(mm.get(3, 1, 0).name).toBe("minecraft:oak_planks");
    expect(mm.get(5, 1, 0).name).toBe("minecraft:oak_planks");
    expect(mm.get(2, 1, 0).name).toBe("minecraft:air");
    expect(mm.meta.regions?.length).toBe(2);
  });

  it("rejects unknown NBT and legacy schematics with helpful errors", () => {
    const junk = writeNbtFile({ name: "", tag: nbt.compound({ Foo: nbt.int(1) }) });
    expect(() => importBytes(junk, "x.nbt")).toThrow(/Unknown NBT structure/);
    const legacy = writeNbtFile({
      name: "Schematic",
      tag: nbt.compound({
        Blocks: nbt.byteArray(new Int8Array(1)),
        Data: nbt.byteArray(new Int8Array(1)),
        Materials: nbt.string("Alpha"),
      }),
    });
    expect(() => importBytes(legacy, "x.schematic")).toThrow(/Legacy/);
  });
});
