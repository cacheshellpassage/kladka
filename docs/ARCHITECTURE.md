# Architecture

```
.
├── packages/
│   ├── voxel-core/     format, NBT, importers/exporters, game knowledge, planner ("smart stages")
│   ├── viewer/         three.js viewer: textures, chunk mesher, materials, environment
│   ├── content/        parametric generators, catalogue, content-pack builder
│   └── renderer-cli/   headless preview renderer (Vite page + Playwright)
├── apps/app/           React UI + Tauri (src-tauri) + Capacitor (android) + PWA
├── tools/              licences, icons, offline check, Android assets, Chunky scene, Python cross-check
└── docs/
```

Everything is TypeScript (strict) in a pnpm workspace. Packages are consumed as TypeScript sources by Vite and
Vitest (no separate build step), which keeps the inner loop fast.

## voxel-core

### Internal model (`model/model.ts`)

`VoxelModel` stores a dense `Uint16Array` of palette indices in Sponge/Litematica order
(`x + z·sizeX + y·sizeX·sizeZ`), a palette (`game`, `id`, `state`, canonical `material`), block entities and entities
as raw NBT (lossless round trips), metadata (DataVersion, origin, author, regions) and optional per-voxel **role**
codes provided by generators.

### Game adapter (`games/`)

All game-specific knowledge sits behind `GameAdapter` (`games/types.ts`). Minecraft Java provides:

| Module           | Purpose                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `blocks.ts`      | shape class, render layer, role hint, support rule, gravity, procedural texture descriptors      |
| `materials.ts`   | canonical materials (oak_stairs → oak_planks), our own colour table, texture patterns            |
| `shapes.ts`      | parametric geometry (boxes in 1/16 units, crossed planes) written from scratch                   |
| `connections.ts` | fence/pane/wall connections and stair corner shapes                                              |
| `items.ts`       | block state → items (upper door halves = 0, double slab = 2, wall torch → torch, …), stack sizes |
| `names.ts`       | ru/en names (Russian adjectives agree with noun gender)                                          |

Hytale (`.prefab.json`) can be added as another adapter plus an importer in `formats/`.

### Formats (`formats/`) — see [FORMATS.md](FORMATS.md)

### Planner — "smart stages" (`plan/`)

1. **Roles.** Generators provide explicit roles. Imported builds are classified by `plan/classify.ts`:
   - _exterior air_ = air reachable from the sides/top of the bounding box through passable blocks
     (air, plants, torches, carpets, liquids); the bottom face is ground and not a seed;
   - _foundation_ = lowest layer with blocks plus following layers covering ≥ 70 % of the footprint (≤ 3 layers);
   - hint-based roles: logs/pillars → frame; doors, glass, panes, gates, bars → openings; furniture → interior;
     light sources → lighting; plants, leaves, signs, banners, liquids → decor;
   - _roof_: sky-exposed exterior stairs/slabs at least two layers above ground; sky-exposed full blocks covering
     enclosed air (flat roofs) and the layers below them; stairs/slabs directly under roof blocks (eave undersides);
   - _corner pillars_: vertical runs (≥ 3) of one block at convex outside corners whose material differs from
     the adjacent wall → frame;
   - fences/walls inside → interior, outside → decor; everything else structural → walls (incl. floors).
2. **Stages.** Role → stage: foundation, frame, walls, openings, roof, interior, decor (lighting is placed in decor).
3. **Placement simulation.** Groups (stage, layer) are processed bottom-up. Inside a group a BFS places a block only
   when its support rule holds:
   - attachables need their specific support (`wall_torch`/`ladder`/wall signs → block behind; torches, carpets,
     plants, doors, beds, rails → block below; hanging lanterns/signs → block above; buttons/levers by `face`);
   - gravity blocks (sand, gravel, concrete powder, anvils) need the block below;
   - other blocks need any already placed face neighbour or the ground.
     Blocks that are not placeable yet are **deferred** and retried after every placement; they are emitted as an
     extra step of the group where they became placeable (e.g. a hanging lantern after the ceiling). Blocks that never
     get support are emitted at the end with a **scaffolding** hint.
4. **Steps.** Placed blocks of a group are split into connected regions (6-connectivity), big regions are cut into
   chunks of ≤ 48 blocks (placement order preserved), chunks are ordered by a nearest-neighbour tour, and small
   neighbouring regions (≤ 24 blocks, gap ≤ 3) are merged into one step.
5. **Companions.** Upper door halves, bed heads and upper halves of tall plants join their partner's step.

Tests (`packages/voxel-core/test/planner.test.ts`) re-simulate every plan and assert that each block is placeable
when its step comes; the catalogue test does the same for all built-in builds (< 2 % scaffolding allowed — all
current builds have 0 %).

Materials (`plan/materials.ts`) count items for any set of voxels and break them into stacks and shulker boxes.
`plan/estimate.ts` gives difficulty 1–5 and a time estimate (≈1.6 s per block + extra for special shapes + 20 s per step).

## viewer

- **Textures** (`textures.ts`): 52 procedural 16×16 patterns (planks, bricks, cobble, bark, rings, leaves, glass…)
  generated from our colour table into one `DataArrayTexture` (mipmaps + anisotropy, sampled with `textureGrad`
  so greedy-merged quads can repeat the texture). An optional `TextureProvider` supplies textures from a resource
  pack the user loaded locally.
- **Mesher** (`mesher.ts`, no three.js dependency): 32³ chunks, greedy meshing of full cubes keyed by
  (palette, per-corner AO, build step); other shapes as boxes/planes; opaque / cutout / translucent passes.
  **Step-aware culling:** a face is removed only if the neighbour is an opaque cube built at the same or an earlier
  step — every intermediate state is watertight, so changing the step is just a uniform update (no remeshing).
  Section views rebuild only chunks whose clip signature changed.
- **Materials** (`material.ts`): patches of `MeshBasicMaterial` (classic: Minecraft-like face shading × baked AO),
  `MeshStandardMaterial` (shaders) and `MeshDepthMaterial` (shadows) adding step visibility, ghosting of future steps
  and lower layers (screen-door dithering — no sorting needed), clip box, type highlight and role colouring.
- **Environment** (`environment.ts`): gradient sky with sun/stars, hemisphere + directional light with soft shadows,
  GTAO + UnrealBloom + ACES output; presets day/sunset/night; quality low/medium/high (pixel ratio, shadows, post).
- Rendering is on demand (only when the camera or a uniform changes) to save battery.

## app

React 19 + Zustand + IndexedDB (`idb`), tiny hash router, typed i18n (ru/en). Heavy work (parsing imports, planning)
runs in a Web Worker. Pages: catalog, build card, guide (step mode), free 3D view, import, settings, about/help/
privacy/licences. Platform glue (`platform/platform.ts`) saves files via a download link (web), the Tauri dialog+fs
plugins (desktop) or Capacitor Filesystem + Share sheet (Android).

The same `dist/` bundle is used for the PWA (service worker precaches everything), Tauri and Capacitor.
A strict CSP without remote origins plus an E2E check that records every request guarantee offline behaviour.

## renderer-cli

`pnpm render:previews` starts a Vite server for `packages/renderer-cli/render`, opens it in headless Chromium/Edge
with software WebGL, and calls `window.kladkaRender(job)` for each build × style × angle. Fixed composition: the
camera fits the bounding box from four 45° azimuths at 26° elevation; classic = light background + grid,
cinematic = "shaders" high quality at sunset.

## Performance targets

- 100×100×100 builds: ≤ 64 chunks of 32³ × 3 passes → < 200 draw calls; greedy meshing keeps vertex counts low.
- Low quality: pixel ratio ≤ 1.25, no shadows/post. Medium: 1024 shadow map + bloom. High: 2048 + GTAO.
- Planning a 64×40×64 hollow box takes ~0.1 s (unit test bound: < 8 s).
