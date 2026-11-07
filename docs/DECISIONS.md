# Decisions log

Every non-obvious choice made while building the project is recorded here with its rationale.
Newest entries are appended at the end of each section. Dates are absolute (YYYY-MM-DD).

## D-001 Target game version (2026-11-07)

- **Minecraft Java Edition 26.3 "Wilderness Bound"**, released 2026-09-15, **DataVersion 5023**.
- Source: Mojang public version manifest (`latest.release = "26.3"`, checked 2026-11-07) and the
  Minecraft Wiki `{{Data version|Java Edition 26.3}}` template (= 5023). Previous releases for reference:
  26.2 = 4903, 26.1 = 4786, 1.21.11 = 4671.
- Java switched to year-based versions in 2026 (1.21.x → 26.1). The constant lives in
  `packages/voxel-core/src/games/minecraft-java/version.ts`; exporters write it as `DataVersion`.
- Built-in content only uses long-standing block IDs (planks, logs, stairs, slabs, glass, …) so files load
  in any modern version (Litematica/WorldEdit run Mojang's DataFixer on older DataVersions anyway).

## D-002 File format specs (2026-11-07)

- **Sponge Schematic v3** (spec dated 2021-05-04, still current): root compound contains a `Schematic`
  compound; blocks live in `Blocks { Palette, Data (varint[]), BlockEntities[] }`; index
  `x + z*Width + y*Width*Length`; block entities are `{ Pos int[3], Id, Data }`.
- **Sponge Schematic v2**: root compound *named* `Schematic`; top level `Palette`, `PaletteMax`,
  `BlockData`, `BlockEntities` (extra fields flattened into the compound).
- **Litematica**: checked the upstream source for MC 26.3 (`sakura-ryoko/litematica`, branch `26.3`):
  `SCHEMATIC_VERSION = 7`, `SCHEMATIC_VERSION_SUB = 1`, readers accept versions 1..7. Block states are a
  bit-packed `long[]` where values **may straddle** long boundaries,
  `bits = max(2, bitLength(paletteSize - 1))`, index `y*sizeX*sizeZ + z*sizeX + x`. Sizes may be
  negative (region extends towards negative axis). We write Version 7 / SubVersion 1 /
  MinecraftDataVersion 5023 and read 4..7.
- **Structure Block `.nbt`**: `DataVersion`, `size[3]`, `palette` (or `palettes`, first one is used),
  `blocks[{state,pos,nbt?}]`, `entities[]`. Missing positions = structure void.

## D-003 Toolchain (2026-11-07)

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 24 LTS (24.22.2) | Active LTS; Node 26 only entered LTS on 2026-10-28, too fresh for native tooling. Installed portably in `%LOCALAPPDATA%\Programs\node24` on the dev machine (no admin rights needed). |
| pnpm | 10.x | Workspaces, strict node_modules, fast CI cache. |
| TypeScript | **6.0.x** (not 7.0) | `typescript-eslint` 8.72 supports `<6.1.0`; TS 7 (native Go port) is not yet supported by the lint toolchain. Strict mode everywhere. |
| Vite | 8.x | Default bundler for React; `@vitejs/plugin-react` 6 requires Vite 8. |
| Vitest | 5.x | Same transform pipeline as Vite. |
| React | 19.x | UI. |
| Zustand | 5.x | Small state store, as required. |
| three.js | 0.187 | 3D viewer; post-processing via `three/addons` (no extra dependency). |
| ESLint 10 + typescript-eslint 8 + Prettier 3 | | Lint/format. |
| Playwright | 1.65 | E2E + headless rendering. Locally uses the installed Microsoft Edge (`channel: "msedge"`) so no browser download is needed; CI installs Chromium. |

## D-004 Native shells (2026-11-07)

- **Desktop: Tauri 2** (2.12). Small binaries, uses system WebView, same web bundle.
- **Android: Capacitor 8** (8.6) instead of Tauri mobile. Reasons: plain Gradle project (no Rust
  cross-compilation / NDK in the Android build), mature WebView pipeline, well documented release signing,
  easy to open in Android Studio for the RuStore upload. The web bundle is identical for PWA/Tauri/Capacitor.
- The dev machine has no Rust, no Visual Studio Build Tools and no Android SDK; by the owner's choice
  (2026-11-07) native builds are **CI-only** (GitHub Actions). Locally we build and test the web/PWA bundle.

## D-005 Working name (2026-11-07)

- Working name: **«Кладка» / "Kladka"** (Russian for "bricklaying"; short, original, no "Minecraft" in it).
  Subtitle: «пошаговые постройки» / "step-by-step builds".
- Single source of truth: `apps/app/src/config/app.config.ts` (+ `app.config.json` consumed by Tauri,
  Capacitor and the PWA manifest generator). App id: `app.kladka.guide` (placeholder, change before
  publishing if you own a domain).

## D-006 Licensing of the project itself (2026-11-07)

- Code: **MIT** (permissive, compatible with all dependencies, store-friendly).
- Built-in content (generated builds, previews, icon): **CC0 1.0**.
- No copyleft dependencies are used in shipped code (audit in `THIRD_PARTY_LICENSES.md`).

## D-007 NBT and compression (2026-11-07)

- We use **our own NBT reader/writer** in `voxel-core` (≈400 lines, big-endian, `bigint` for longs,
  typed arrays). `prismarine-nbt` depends on `protodef` and Node's `Buffer`, which needs polyfills in the
  browser bundle and is not tree-shakable. It is still used **as a dev dependency in tests** to cross-check
  that our output is readable by an independent implementation.
- Gzip/zip: **fflate** (MIT, tiny, synchronous, works in Node and browsers).
- Python `litemapy`/`nbtlib` cross-checks are not available locally (no Python on the dev machine);
  instead tests use bit-exact vectors derived from Litematica's Java algorithm and the prismarine-nbt
  round trip. An optional Python cross-check script is provided in `tools/` for CI/dev machines with Python.

## D-008 Monorepo layout (2026-11-07)

As proposed in the brief, with two small additions:

- `packages/voxel-core` – format, NBT, importers/exporters, planner ("smart stages"), materials, 2D plans.
  Game-specific knowledge lives under `src/games/<game>/` behind a `GameAdapter` interface so Hytale
  (`.prefab.json`) can be added without touching the planner.
- `packages/viewer` – three.js viewer (chunked greedy meshing, procedural textures, classic + "shader" modes).
- `packages/content` – parametric generators + `build-pack` script producing `packs/core`.
- `packages/renderer-cli` – headless preview renderer (Playwright) – `pnpm render:previews`.
- `apps/app` – React UI + Tauri (`src-tauri`) + Capacitor (`android`) + PWA.
- `tools/` – optional helper scripts (Chunky scene export, Python cross-check).

## D-009 Rendering approach (2026-11-07)

- **No Mojang textures/models.** Block faces use procedurally generated 16×16 textures (planks, bricks,
  stone speckle, bark, leaves, glass frame, wool…) drawn at runtime into a `DataArrayTexture`. Colours are our
  own approximations. Users may optionally load their own resource pack / `client.jar` locally (read in the
  browser, never copied or uploaded).
- Non-cube blocks (stairs, slabs, fences, walls, panes, doors, trapdoors, torches, lanterns, ladders,
  carpets, plants…) are parametric box/quad meshes written in code.
- Meshes are built per 32³ chunk with greedy meshing for full cubes; opaque / cutout / translucent are
  separate draw calls → ≤ ~200 draw calls for a 100³ build.
- Step visibility is done **without rebuilding meshes**: every face carries the global step index of its
  block; a uniform hides faces of future steps and highlights the current step. Face culling only removes a
  face if the neighbour is built at the same or an earlier step, so every intermediate state is watertight.
- Classic mode: unlit vertex-shaded (Minecraft-like directional face shading + baked AO) → fastest on phones.
  "Shaders" mode: `MeshStandardMaterial` + soft shadows + sky + fog + GTAO + bloom + ACES tone mapping,
  with low/medium/high presets and day/sunset/night.

## D-010 UI plumbing (2026-11-07)

- Routing: a tiny hash router (works under `file://`, Tauri and Capacitor without server rewrites).
- i18n: a small typed dictionary module (`ru` default, `en`); TypeScript enforces that both locales have the
  same keys. Avoids two runtime dependencies for what is a static lookup.
- Storage: IndexedDB via `idb` (imports, favourites, progress, settings mirror).
- PDF export: a minimal in-house PDF writer embedding JPEG pages (no jsPDF, ~100 lines).
- GIF export: `gifenc` (MIT). Video: `MediaRecorder` (WebM) when the platform supports it.
