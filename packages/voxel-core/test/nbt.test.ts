import { describe, expect, it } from "vitest";
import * as pnbt from "prismarine-nbt";
import { gunzipSync } from "fflate";
import {
  decodeMutf8,
  encodeMutf8,
  nbt,
  nbtEquals,
  readNbt,
  readNbtFile,
  writeNbt,
  writeNbtFile,
  type NbtRoot,
} from "../src";

function sample(): NbtRoot {
  return {
    name: "root",
    tag: nbt.compound({
      b: nbt.byte(-5),
      s: nbt.short(-1234),
      i: nbt.int(2147483647),
      l: nbt.long(-9007199254740993n),
      f: nbt.float(1.5),
      d: nbt.double(Math.PI),
      ba: nbt.byteArray(Int8Array.from([1, -2, 3])),
      str: nbt.string("Кладка ✓ \u0000 😀"),
      plain: nbt.string("Кладка ✓ ступени"),
      emptyList: nbt.list("compound", []),
      list: nbt.list("int", [nbt.int(1), nbt.int(2)]),
      nested: nbt.compound({ "0": nbt.string("zero"), a: nbt.string("a") }),
      ia: nbt.intArray([1, -1, 99]),
      la: nbt.longArray([1n, -1n, 2n ** 62n]),
    }),
  };
}

describe("NBT codec", () => {
  it("round-trips every tag type losslessly", () => {
    const root = sample();
    const back = readNbt(writeNbt(root));
    expect(back.name).toBe("root");
    expect(nbtEquals(back.tag, root.tag)).toBe(true);
    // Map preserves insertion order even for integer-like keys
    const nested = back.tag.value.get("nested");
    expect(nested?.kind === "compound" && [...nested.value.keys()]).toEqual(["0", "a"]);
  });

  it("encodes modified UTF-8 like Java", () => {
    const enc = encodeMutf8("\u0000");
    expect([...enc]).toEqual([0xc0, 0x80]);
    const emoji = encodeMutf8("😀");
    expect(emoji.length).toBe(6); // two 3-byte surrogates
    expect(decodeMutf8(emoji, 0, emoji.length)).toBe("😀");
  });

  it("gzip helpers round-trip", () => {
    const root = sample();
    const gz = writeNbtFile(root);
    expect(gz[0]).toBe(0x1f);
    expect(nbtEquals(readNbtFile(gz).tag, root.tag)).toBe(true);
  });

  it("is readable by prismarine-nbt (independent implementation)", async () => {
    const root = sample();
    const bytes = writeNbt(root);
    const { parsed, type } = await pnbt.parse(Buffer.from(bytes));
    expect(type).toBe("big");
    const simple = pnbt.simplify(parsed) as Record<string, unknown>;
    expect(simple.i).toBe(2147483647);
    // prismarine-nbt decodes standard UTF-8 (not Java's MUTF-8), so only BMP text without NUL is comparable
    expect(simple.plain).toBe("Кладка ✓ ступени");
    expect(simple.ia).toEqual([1, -1, 99]);
  });

  it("reads files written by prismarine-nbt", () => {
    const written = pnbt.writeUncompressed(
      {
        type: "compound",
        name: "",
        value: {
          Name: { type: "string", value: "test" },
          Pos: { type: "list", value: { type: "int", value: [1, 2, 3] } },
          Longs: {
            type: "longArray",
            value: [
              [0, 5],
              [-1, -1],
            ],
          },
        },
      } as never,
      "big",
    );
    const r = readNbt(new Uint8Array(written));
    const c = r.tag.value;
    expect(c.get("Name")).toEqual(nbt.string("test"));
    const longs = c.get("Longs");
    expect(longs?.kind === "longArray" && Array.from(longs.value)).toEqual([5n, -1n]);
  });

  it("rejects truncated data with a readable error", () => {
    const bytes = writeNbt(sample()).slice(0, 20);
    expect(() => readNbt(bytes)).toThrow(/Unexpected end/);
    void gunzipSync;
  });
});
