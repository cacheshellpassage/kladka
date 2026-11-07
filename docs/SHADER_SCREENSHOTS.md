# "Real" shader screenshots (optional)

The app ships covers rendered by our own three.js pipeline (`pnpm render:previews`, styles `classic` and
`cinematic`). If you want covers rendered by the game itself or by a path tracer, use one of the options below.
This is optional and never blocks a release.

> Screenshots made in the game or with vanilla/third-party resource packs contain textures that are not ours.
> Keep them for personal use; do **not** commit them to the repository or ship them in the app/store listing
> unless the texture licence explicitly allows it.

## Option A — in-game with Iris + a shader pack

1. Install Fabric for the target version, then Iris (and Sodium) and a shader pack you are allowed to use
   (e.g. Complementary Shaders — check its licence for screenshot usage).
2. Create a superflat creative world, `/gamerule doDaylightCycle false`, `/time set 12500` (golden hour).
3. Export the build from the app as `.schem` and paste it with WorldEdit at a known position, e.g. `0 64 0`:
   `//schem load <name>` → stand at `0 64 0` → `//paste -a`.
4. Use the camera positions printed by `node tools/chunky-scene.mjs` (Option B) for consistent framing:
   `/tp @s <x> <y> <z> <yaw> <pitch>`, hide the HUD with F1, take the screenshot with F2.

## Option B — path tracing with Chunky (headless)

[Chunky](https://chunky-dev.github.io/docs/) renders Minecraft worlds offline and supports a headless CLI.

1. Create the world and paste the build as in Option A (Chunky needs a saved world on disk).
2. Generate scene files with the same four camera angles we use for covers:

   ```bash
   node tools/chunky-scene.mjs --world "C:/path/to/.minecraft/saves/Previews" --size 11x14x9 --origin 0,64,0 --name medieval-house
   ```

   This writes `scenes/medieval-house-<angle>/medieval-house-<angle>.json` (camera position/orientation,
   sun altitude for golden hour, 512 SPP, output 1600×1000) — one scene per angle.

3. Load the chunks once in the Chunky GUI (Chunky needs the chunk selection), or pass `-reload-chunks`, then render
   headless:

   ```bash
   java -jar ChunkyLauncher.jar -scene-dir scenes -render medieval-house-0 -f
   ```

4. The PNG is written to `scenes/medieval-house-0/snapshots/`.

The camera math in `tools/chunky-scene.mjs` mirrors `VoxelViewer.resetCamera()` (bounding box fit, 45° azimuths,
26° elevation, FOV 40°), so in-game, Chunky and in-app covers line up.
