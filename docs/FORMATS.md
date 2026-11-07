# File formats

| Format                         | Import                                | Export                      | Notes                                                                  |
| ------------------------------ | ------------------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| Sponge Schematic `.schem` v1   | ✅                                    | —                           | WorldEdit ≤ 7.1                                                        |
| Sponge Schematic `.schem` v2   | ✅                                    | ✅                          | root compound named `Schematic`, top-level `Palette`/`BlockData`       |
| Sponge Schematic `.schem` v3   | ✅                                    | ✅ (default)                | root `{ Schematic: {...} }`, `Blocks { Palette, Data, BlockEntities }` |
| Litematica `.litematic` v4–v7  | ✅ (all sub-regions)                  | ✅ v7 / sub-version 1       | bit-packed `long[]`, values may straddle longs                         |
| Structure block `.nbt`         | ✅ (`palette` or first of `palettes`) | ✅ (air written explicitly) | missing positions = structure void                                     |
| Kladka build `.kbuild`         | ✅                                    | ✅ (content packs)          | gzip JSON: palette, RLE blocks, RLE roles, metadata                    |
| Content pack `.zip`            | ✅                                    | —                           | `pack.json` + build files                                              |
| MCEdit `.schematic` (pre-1.13) | ❌ (clear error)                      | —                           | numeric ids; re-save as `.schem`                                       |

Target version: Minecraft Java 26.3, **DataVersion 5023** (exported files carry it). Older files keep their
DataVersion on import; the game/mods upgrade them with DataFixerUpper when loading.

## NBT

Own big-endian codec (`packages/voxel-core/src/nbt`): all 13 tag types, Java modified UTF-8 strings, `bigint` longs,
`Map` compounds (insertion order preserved, also for numeric-looking keys), typed accessors with readable errors.
Compression: gzip/zlib detected automatically (fflate).

## Sponge v3 details

- `Width/Height/Length` are unsigned shorts stored in signed `TAG_Short`.
- Block data: LEB128 varints, index `x + z·W + y·W·L`.
- Block entities: `{ Pos: int[3], Id, Data }` (v3) or flattened (v2: extra fields next to `Pos`/`Id`).
- `Metadata` is preserved on round trips; `Name`, `Author`, `Date` are written.

## Litematica details

- Root: `MinecraftDataVersion`, `Version` (7), `SubVersion` (1), `Metadata` (`Name`, `Author`, `Description`,
  `RegionCount`, `TotalBlocks`, `TotalVolume`, `TimeCreated`, `TimeModified`, `EnclosingSize`), `Regions`.
- Region: `Position`, `Size` (may be negative), `BlockStatePalette` (`Name` + `Properties`), `BlockStates`,
  `TileEntities` (`x, y, z` relative to the region minimum), `Entities`, `PendingBlockTicks`, `PendingFluidTicks`.
- Bits per entry: `max(2, bitLength(paletteSize − 1))`; total longs `ceil(volume·bits/64)`.
- Multi-region files are merged into one model; region boxes are kept in `meta.regions`.

## Compatibility checks

- `packages/voxel-core/test/formats.test.ts`
  - round trip of every export format (blocks, states, block entities);
  - spec structure assertions (tag names and types per format);
  - Litematica packing compared **bit-for-bit** with a line-by-line port of Litematica's `LitematicaBitArray#setAt`;
  - output readable by **prismarine-nbt** (independent implementation);
  - multi-region import with negative sizes; helpful errors for unknown/legacy files.
- `tools/crosscheck_litemapy.py` (optional, needs Python + `litemapy` + `nbtlib`): reads our `.litematic`/`.schem`
  exports with litemapy and compares block counts and palettes. Not run in CI by default.

## Known limitations

- Entities are preserved but not rendered.
- Block-entity contents (chest items, sign text) are preserved but not shown.
- Modded blocks render with deterministic placeholder colours.
- Biomes are ignored (Sponge v3 biome container is not written).
