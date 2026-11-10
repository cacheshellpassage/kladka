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
- **Sponge Schematic v2**: root compound _named_ `Schematic`; top level `Palette`, `PaletteMax`,
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

| Tool                                         | Version             | Why                                                                                                                                                                                   |
| -------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                                      | 24 LTS (24.22.2)    | Active LTS; Node 26 only entered LTS on 2026-10-28, too fresh for native tooling. Installed portably in `%LOCALAPPDATA%\Programs\node24` on the dev machine (no admin rights needed). |
| pnpm                                         | 10.x                | Workspaces, strict node_modules, fast CI cache.                                                                                                                                       |
| TypeScript                                   | **6.0.x** (not 7.0) | `typescript-eslint` 8.72 supports `<6.1.0`; TS 7 (native Go port) is not yet supported by the lint toolchain. Strict mode everywhere.                                                 |
| Vite                                         | 8.x                 | Default bundler for React; `@vitejs/plugin-react` 6 requires Vite 8.                                                                                                                  |
| Vitest                                       | 5.x                 | Same transform pipeline as Vite.                                                                                                                                                      |
| React                                        | 19.x                | UI.                                                                                                                                                                                   |
| Zustand                                      | 5.x                 | Small state store, as required.                                                                                                                                                       |
| three.js                                     | 0.187               | 3D viewer; post-processing via `three/addons` (no extra dependency).                                                                                                                  |
| ESLint 10 + typescript-eslint 8 + Prettier 3 |                     | Lint/format.                                                                                                                                                                          |
| Playwright                                   | 1.65                | E2E + headless rendering. Locally uses the installed Microsoft Edge (`channel: "msedge"`) so no browser download is needed; CI installs Chromium.                                     |

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

## D-011 Buildability rules for generated roofs (2026-11-07)

- Unit tests re-simulate every plan. They showed that hip/cone roofs made only of stairs are **not placeable by
  hand** (each ring touches the previous one only diagonally). Roof helpers now lay a ring of full blocks under every
  next ring (`underFill`), gables with open ends or overhangs > 1 do the same, and roofs start on the ceiling layer.
  All 36 built-in builds need 0 scaffolding blocks (test threshold: < 2 %).

## D-012 Step granularity (2026-11-07)

- Max 48 blocks per step; small neighbouring regions (≤ 24 blocks, bounding-box gap ≤ 3) are merged so that e.g. two
  window panes become one step instead of two. Typical build: 40–200 steps.

## D-013 Covers (2026-11-07)

- 800×500 WebP covers (q 0.8) + 384×240 thumbnails, classic and cinematic, 4 angles → ≈ 5.6 MB for 36 builds.
- Cinematic = "shaders" high quality at golden hour (sunset preset tuned for readability).
- Rendered with the locally installed Edge (software WebGL, ~5 s per build); CI can use Playwright's Chromium.

## D-014 Resource packs / client.jar (2026-11-07)

- Users can load their own resource pack or `client.jar`; textures under `assets/minecraft/textures/block/` are
  decoded locally (first animation frame, scaled to 16×16, biome tint for grass/leaves applied with fixed colours)
  and mapped to our blocks by naming conventions (`<id>`, `<id>_top`, `<material>`, `<log>_top`, …).
- Optional "remember on this device" stores the extracted 16×16 textures in IndexedDB; off by default.
- Verified with a real 26.1.2 client jar on the owner's machine (1112 textures, correct mapping); no such
  texture or screenshot is stored in the repository.

## D-015 Android permissions (2026-11-07)

- Kept Capacitor's default `INTERNET` permission (the WebView serves the bundle from `https://localhost`); the app
  makes no network requests (CSP + E2E request audit + `pnpm check:offline`). Removing the permission is documented in
  RUSTORE.md as an option to test on a device.

## D-016 Local verification limits (2026-11-07)

- Locally verified: unit tests, E2E (Edge), web/PWA build, offline audit, licence audit, Tauri icon generation,
  Capacitor Android project generation. Not verified locally (no Rust / VS Build Tools / Android SDK by the owner's
  choice): `tauri build` and Gradle builds — these run in GitHub Actions.

## D-017 Colour palette based on colour-preference research (2026-11-09)

- Replaced the warm terracotta/beige palette with cool blue-tinted neutrals and one saturated blue accent.
- Reasons:
  - Palmer & Schloss (PNAS 2010, ecological valence theory): average preference peaks at saturated blue and is
    lowest for dark yellow/olive and dark orange (brown). The old UI leaned on beige/brown tones.
  - Schloss & Palmer (2011): pair preference and harmony grow with hue similarity and with figure-ground lightness
    contrast. Hence one hue family (blue → indigo gradients, blue-grey neutrals) and high text contrast.
  - 60-30-10 practice: neutral background (~60%), white surfaces (~30%), accent only on actions, the current step
    and selection (~10%). This is a design heuristic, not a research result.
  - The builds themselves are mostly warm (wood, stone, brick); a cool frame lets them stand out, and the blue
    step outline is the complementary hue to wood, so it is easy to spot.
- All text pairs pass WCAG 2.2 AA (light: text 17.7:1, muted 6.4:1, white on accent 5.2:1; dark: text 14.6:1,
  muted 6.8:1, dark text on accent 7.1:1). The icon, splash, PWA/Android theme colours, 2D plan and 3D highlight
  use the same palette.

## D-018 Visual refinements (2026-11-09)

- **Block icons**: material lists show isometric "inventory" icons drawn with Canvas 2D from the same procedural
  textures and parametric shapes as the 3D view (or from the user's resource pack). Nothing is shipped as images.
- **Covers** are rendered on a transparent background (WebP with alpha) with a soft contact shadow, so the same
  files suit the light and the dark theme; the card behind them draws a theme-aware backdrop.
- **3D (classic)**: the ground now counts as an occluder for vertex AO (darker bottom edge of the lowest blocks),
  plus a blurred footprint "contact shadow" when the whole build is shown. New blocks of the next step drop into
  place (420 ms, skipped with "reduce motion").
- **Typography**: Inter Variable (OFL-1.1, `@fontsource-variable/inter`) is bundled; tabular numerals for counters.
- **Stage colours**: stages are ordered, so they use one blue ordinal ramp (foundation darkest → decor lightest),
  validated with the dataviz ordinal checks (one hue, monotone lightness, ΔL ≥ 0.06, light end ≥ 2:1). Labels
  always stay in text colours; the 3D "colour by stage" view uses the same ramp with a legend.
- **Wide screens** (≥ 1100 px): navigation moves to a left rail so the 3D view and the step panel get the full
  height; the in-game plan zooms to the current step's blocks.

## D-019 Fewer steps, import covers, client.jar help, community links (2026-11-09)

- **Pillars in one step.** Layer-by-layer planning made the builder walk between posts once per layer. A post-pass
  joins same-footprint chains on consecutive layers into one bottom-up step when every lifted block stays supported
  (re-checked by the placement simulation in the tests for all 36 builds), and joins same-kind single blocks on one
  layer. The step card says “Pillar: place it bottom-up” and shows the layer range.
- **Import covers.** Imports render two 800×500 covers on the device: classic (transparent, like the built-in
  ones) and shaders (golden hour). Older imports get them the first time their page is opened.
- **client.jar help.** Per-OS steps with the `versions` folders of the official launcher, TLauncher (Legacy),
  Prism Launcher and CurseForge and a copy button; a web page cannot open a dialog in a given folder, so the user
  pastes the path into the dialog. The desktop app opens the dialog right there (dialog `open` + fs `read-file`
  limited to the launchers' folders). Not built locally — verified in CI only.
- **Community links** open in the system browser (`@tauri-apps/plugin-opener` on desktop, Capacitor's external
  navigation on Android, a new tab on the web). Nothing is fetched by the app (see LEGAL.md).
- Declined by the owner: generated surroundings (terrain) around builds.

## D-020 Gaps found in a competitor review (2026-11-09)

A review of shulkr.com (browser schematic viewer/editor) listed what Kladka lacked; the owner chose:

- **Block details on tap** (3D view): name, coordinates, every block-state property in plain words, and the
  exact `id[key=value]` string for game commands, with a copy button.
- **Measuring**: tap two corner blocks → box size W × H × D, number of blocks inside and their materials; the
  box is drawn in 3D.
- **Fly camera**: first-person noclip (WASD/arrows, Space/Shift, drag to look; on-screen pad on touch screens).
- **Build passport**: distinct block types, size class (S < 1k, M < 10k, L < 100k, XL), the game version the
  file was saved in (DataVersion table), the oldest Java release that has every vanilla block it uses (table of
  blocks added from 1.14 to 1.21.9; newer or unknown ids cannot raise the minimum, so the wording is “and
  newer”), and required mods (non-`minecraft` namespaces).
- **Top view** as a fifth cover angle, aligned with the 2D plan (north up). `render:previews` now keeps existing
  angles when rendering one, and retries writes that Windows briefly locks.

Not taken (need a server, accounts or network, or out of scope): community catalogue and uploads, comments,
duplicate detection, AI builder, test servers, URL import, Bedrock `.mcstructure`, a full editor, bundled
game or mod textures.

## D-021 Usability pass from a full user walkthrough (2026-11-10)

The app was walked end to end as a builder (catalogue, build page, checklist, export, all 92 steps of the
mini-castle, in-game mode, free 3D view, import, settings, help) on a phone in both orientations, a tablet and
a desktop, in both themes and both languages. A script took a screenshot of every screen and listed clipped
text, horizontal overflow, small tap targets and console errors. What changed:

- **Plan letters belong to an item, not to a layer.** The most used item of a build is "A" everywhere: on every
  layer of the plan, in the step card, in the material list, in the in-game mode and in PNG/PDF export (which
  now prints the layer legend under the plan). Before, the same letter meant different blocks on different
  layers, and stairs had four letters, one per facing.
- **The step card says what to place**: icon, letter, name and count for the blocks of the step (up to four
  lines, then "and N more"), so the builder does not have to scroll to the material list.
- **Same-kind rows are joined** in the planner (`mergeSameKindRows`), and a step with several identical pillars
  says how many there are. The mini-castle went from 99 steps to 92, the whole catalogue from 1320 to 1235.
- **Finishing a build is a state, not a dead end**: a finish card with totals, links to the 3D view and to the
  catalogue, and "all steps done" instead of "step 92 of 92"; the main button leads to the catalogue.
- **Phones get one view at a time** (3D or plan). The side-by-side view needs about 600 px of width, so it is
  offered on tablets and desktops only; a saved "3D + plan" choice falls back to 3D on a phone.
- **The plan fits the whole layer by default** (cells may shrink to 5 px and drop their letters) with a switch
  to zoom to the blocks of the step. Before, a 25-block-wide layer was cut off on a phone.
- **A phone held sideways** gets its own layouts: the guide, the 3D view, the build page and the in-game mode
  put the picture on one side and the text and buttons on the other, and the top bar is hidden on the
  full-screen pages (each has its own "back").
- **Tap targets** on touch screens are at least 40-44 px (checkboxes keep their 24 px look and get a larger hit
  area), the block card in the 3D view no longer covers the zoom buttons, launcher tabs in the help wrap
  instead of scrolling sideways.
- **Catalogue**: easiest builds first by default, correct Russian plurals ("36 построек"), style names wrap
  instead of being clipped.
- Keyboard hints are shown only where there is a keyboard; loading states replace empty panels.
- The root `pnpm build` script failed (no package has a `build` script); it now builds the app.

Not verifiable here: real phone hardware (touch, notches, performance) and the Android/Tauri builds, which
run in CI only.
