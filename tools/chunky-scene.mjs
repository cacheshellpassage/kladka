#!/usr/bin/env node
/**
 * Optional helper: writes Chunky scene JSON files (one per cover angle) for a build pasted into a world,
 * using the same framing as the in-app covers. Also prints Minecraft /tp commands for in-game screenshots.
 *
 * Usage:
 *   node tools/chunky-scene.mjs --world <saves/World> --size WxHxD --origin x,y,z --name <id> [--out scenes] [--spp 512]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
}

const world = arg("world");
const [sx, sy, sz] = (arg("size") ?? "16x16x16").split("x").map(Number);
const [ox, oy, oz] = (arg("origin") ?? "0,64,0").split(",").map(Number);
const name = arg("name", "build");
const outDir = arg("out", "scenes");
const spp = Number(arg("spp", "512"));
const width = 1600,
  height = 1000,
  fov = 40;

// same maths as VoxelViewer.resetCamera(): fit the bounding box from 4 azimuths at 26° elevation
const deg = Math.PI / 180;
function cameraFor(preset) {
  const az = [45, 135, 225, 315][preset] * deg;
  const el = 26 * deg;
  const back = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  const fwd = back.map((v) => -v);
  const right = [-fwd[2], 0, fwd[0]];
  const rl = Math.hypot(...right);
  const r = right.map((v) => v / rl);
  const up = [r[1] * fwd[2] - r[2] * fwd[1], r[2] * fwd[0] - r[0] * fwd[2], r[0] * fwd[1] - r[1] * fwd[0]];
  const tanV = Math.tan((fov / 2) * deg) * 0.9;
  const tanH = tanV * (width / height);
  let dist = 4;
  for (const cx of [-sx / 2, sx / 2])
    for (const cy of [-sy / 2, sy / 2])
      for (const cz of [-sz / 2, sz / 2]) {
        const p = [cx, cy, cz];
        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const z = dot(p, fwd);
        dist = Math.max(dist, z + Math.abs(dot(p, r)) / tanH, z + Math.abs(dot(p, up)) / tanV);
      }
  const target = [ox + sx / 2, oy + sy / 2, oz + sz / 2];
  const pos = target.map((t, i) => t + back[i] * dist);
  // Minecraft yaw: 0 = south (+z), 90 = west; pitch: positive looks down
  const yaw = (Math.atan2(-fwd[0], fwd[2]) / deg + 360) % 360;
  const pitch = -Math.asin(fwd[1]) / deg;
  return { pos, yaw, pitch };
}

mkdirSync(outDir, { recursive: true });
for (let a = 0; a < 4; a++) {
  const c = cameraFor(a);
  const sceneName = `${name}-${a}`;
  const dir = join(outDir, sceneName);
  mkdirSync(dir, { recursive: true });
  const scene = {
    sdfVersion: 9,
    name: sceneName,
    width,
    height,
    exposure: 1.0,
    postprocess: "GAMMA",
    sppTarget: spp,
    world: world ? { path: world, dimension: 0 } : undefined,
    camera: {
      name: "camera 1",
      position: { x: c.pos[0], y: c.pos[1], z: c.pos[2] },
      orientation: { roll: 0, pitch: -c.pitch * deg, yaw: (-c.yaw + 180) * deg },
      projectionMode: "PINHOLE",
      fov,
    },
    sun: { altitude: 0.35, azimuth: 1.1, intensity: 1.25, color: { red: 1.0, green: 0.85, blue: 0.7 } },
    sky: { skyMode: "SIMULATED" },
    renderActors: false,
  };
  writeFileSync(join(dir, `${sceneName}.json`), JSON.stringify(scene, null, 2));
  console.log(
    `${sceneName}: /tp @s ${c.pos.map((v) => v.toFixed(2)).join(" ")} ${c.yaw.toFixed(1)} ${c.pitch.toFixed(1)}`,
  );
}
console.log(`\nScenes written to ${outDir}. Select the chunks once in Chunky's GUI, then render headless.`);
