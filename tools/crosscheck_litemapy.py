#!/usr/bin/env python3
"""
Optional cross-check of our exporters against an independent implementation (litemapy + nbtlib).

    pip install litemapy nbtlib
    pnpm --filter @kladka/content exec tsx src/dev/export-samples.ts ../../out   # or export from the app
    python tools/crosscheck_litemapy.py out/*.litematic out/*.schem

For every .litematic file the script loads it with litemapy and prints size, region count, non-air block count
and palette size. For .schem files it uses nbtlib to check the Sponge structure (Version, Width/Height/Length,
palette size and that the varint data decodes to Width*Height*Length entries).
Exit code 1 if any file fails to load.
"""
import sys


def varint_count(data: bytes) -> int:
    n = 0
    for b in data:
        if b & 0x80 == 0:
            n += 1
    return n


def check_litematic(path: str) -> None:
    from litemapy import Schematic

    schem = Schematic.load(path)
    blocks = 0
    palette = set()
    for region in schem.regions.values():
        for x in region.range_x():
            for y in region.range_y():
                for z in region.range_z():
                    b = region[x, y, z]
                    if b.id != "minecraft:air":
                        blocks += 1
                        palette.add(b.id)
    print(f"{path}: litematic OK, regions={len(schem.regions)}, size={schem.width}x{schem.height}x{schem.length}, blocks={blocks}, block types={len(palette)}")


def check_schem(path: str) -> None:
    import nbtlib

    f = nbtlib.load(path)
    root = f.get("Schematic", f)
    version = int(root["Version"])
    w, h, l = (int(root[k]) & 0xFFFF for k in ("Width", "Height", "Length"))
    if version >= 3:
        blocks = root["Blocks"]
        palette, data = blocks["Palette"], bytes(b & 0xFF for b in blocks["Data"])
    else:
        palette, data = root["Palette"], bytes(b & 0xFF for b in root["BlockData"])
    count = varint_count(data)
    assert count == w * h * l, f"varint entries {count} != volume {w * h * l}"
    print(f"{path}: schem v{version} OK, size={w}x{h}x{l}, palette={len(palette)}")


def main(paths):
    failed = 0
    for p in paths:
        try:
            if p.endswith(".litematic"):
                check_litematic(p)
            elif p.endswith(".schem"):
                check_schem(p)
            else:
                print(f"{p}: skipped")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"{p}: FAILED: {e}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
