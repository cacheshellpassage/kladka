/**
 * Small isometric "inventory" icons for blocks, drawn with Canvas 2D from the same procedural textures
 * (or the user's resource-pack textures) and the same parametric shapes as the 3D view.
 */
import { blockInfo, shapeGeometry, state, type Box } from "@kladka/voxel-core";
import type { FaceSlot, TextureProvider } from "./palette-render";
import { TEX, generateTexture } from "./textures";

type TexSource = HTMLCanvasElement;

const texCache = new Map<string, TexSource>();
const urlCache = new Map<string, string>();

function toCanvas(px: Uint8Array): TexSource {
  const c = document.createElement("canvas");
  c.width = c.height = TEX;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(TEX, TEX);
  // stored bottom-up → flip to image space
  for (let row = 0; row < TEX; row++) {
    const src = (TEX - 1 - row) * TEX * 4;
    img.data.set(px.subarray(src, src + TEX * 4), row * TEX * 4);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function texture(name: string, slot: FaceSlot, provider: TextureProvider | null, box?: Box): TexSource {
  const info = blockInfo(name);
  const def =
    box?.tint !== undefined
      ? { pattern: "leaves" as const, color: box.tint, accent: box.tint }
      : box?.glow
        ? { pattern: "glow" as const, color: info.tex.side.accent ?? 0xffd860, accent: 0xffffff }
        : info.tex[slot];
  const fromPack =
    !box?.glow && box?.tint === undefined ? provider?.get(name, slot, info.material) : undefined;
  const key = fromPack ? `rp:${provider!.id}:${name}:${slot}` : JSON.stringify(def);
  let c = texCache.get(key);
  if (!c) {
    c = toCanvas(fromPack && fromPack.length === TEX * TEX * 4 ? fromPack : generateTexture(def));
    texCache.set(key, c);
  }
  return c;
}

/** Draws an isometric icon of `blockName` (default state) into a `size`×`size` canvas. */
export function drawBlockIcon(
  ctx: CanvasRenderingContext2D,
  blockName: string,
  size: number,
  provider: TextureProvider | null = null,
): boolean {
  const name = blockName.includes(":") ? blockName : `minecraft:${blockName}`;
  const info = blockInfo(name);
  if (info.shape === "air") return false;
  const geo = shapeGeometry(state(name), info);
  ctx.imageSmoothingEnabled = false;

  const k = (size * 0.86) / 1.732;
  const cx = size / 2;
  const top = (size - 2 * k) / 2;
  // small shapes (lantern, torch, button…) are scaled up around their centre to fill the icon
  const lo = [16, 16, 16],
    hi = [0, 0, 0];
  for (const b of geo.boxes)
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i]!, b.from[i]!);
      hi[i] = Math.max(hi[i]!, b.to[i]!);
    }
  const extent = Math.max(hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!, 1);
  const fit = Math.min(2.2, 16 / extent);
  const mid = lo.map((v, i) => (v + hi[i]!) / 2);
  const P = (x0: number, y0: number, z0: number): [number, number] => {
    const x = 8 + (x0 - mid[0]!) * fit,
      y = 8 + (y0 - mid[1]!) * fit,
      z = 8 + (z0 - mid[2]!) * fit;
    return [cx + ((x - z) / 16) * 0.866 * k, top + ((x + z) / 16) * 0.5 * k - (y / 16) * k + k];
  };
  /** Draws one textured face (unit square → parallelogram) into `g`, darkened by `shade`. */
  const face = (
    g: CanvasRenderingContext2D,
    tex: TexSource,
    o: [number, number],
    u: [number, number],
    v: [number, number],
    src: [number, number, number, number],
    shade: number,
  ) => {
    const [sx, sy, sw, sh] = src;
    if (sw <= 0 || sh <= 0) return;
    g.setTransform(u[0] - o[0], u[1] - o[1], v[0] - o[0], v[1] - o[1], o[0], o[1]);
    g.drawImage(tex, sx, sy, sw, sh, 0, 0, 1, 1);
    if (shade < 1) {
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = `rgba(0,0,0,${1 - shade})`;
      g.fillRect(0, 0, 1, 1);
      g.globalCompositeOperation = "source-over";
    }
  };

  // plants, panes and bars drawn as flat sprites (like inventory icons)
  if ((geo.planes && !geo.boxes.length) || info.shape === "pane") {
    const tex = texture(name, "side", provider);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const s = size * 0.8;
    ctx.drawImage(tex, 0, 0, TEX, TEX, (size - s) / 2, (size - s) / 2, s, s);
    return true;
  }

  // a layer per box so "source-atop" shading only darkens that face
  const boxes = [...geo.boxes].sort(
    (a, b) =>
      a.from[0] + a.to[0] + a.from[2] + a.to[2] - (b.from[0] + b.to[0] + b.from[2] + b.to[2]) ||
      a.from[1] - b.from[1],
  );
  const layer = document.createElement("canvas");
  layer.width = layer.height = size;
  const lctx = layer.getContext("2d")!;
  for (const b of boxes) {
    const [x0, y0, z0] = b.from;
    const [x1, y1, z1] = b.to;
    const faces: Array<(g: CanvasRenderingContext2D) => void> = [
      (g) =>
        face(
          g,
          texture(name, "top", provider, b),
          P(x0, y1, z0),
          P(x1, y1, z0),
          P(x0, y1, z1),
          [x0, z0, x1 - x0, z1 - z0],
          1,
        ),
      (g) =>
        face(
          g,
          texture(name, "side", provider, b),
          P(x0, y1, z1),
          P(x1, y1, z1),
          P(x0, y0, z1),
          [x0, TEX - y1, x1 - x0, y1 - y0],
          0.8,
        ),
      (g) =>
        face(
          g,
          texture(name, "side", provider, b),
          P(x1, y1, z1),
          P(x1, y1, z0),
          P(x1, y0, z1),
          [TEX - z1, TEX - y1, z1 - z0, y1 - y0],
          0.62,
        ),
    ];
    for (const f of faces) {
      // draw the face into the scratch layer, then composite onto the icon
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, size, size);
      lctx.imageSmoothingEnabled = false;
      f(lctx);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(layer, 0, 0);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return true;
}

/** Cached PNG data URL of a block icon (renders at `size` CSS px × devicePixelRatio). */
export function blockIconUrl(
  blockName: string,
  size: number,
  provider: TextureProvider | null = null,
): string | null {
  const dpr = Math.min(3, Math.max(1, Math.round(globalThis.devicePixelRatio || 1)));
  const px = size * dpr;
  const key = `${provider?.id ?? "-"}|${blockName}|${px}`;
  const hit = urlCache.get(key);
  if (hit !== undefined) return hit || null;
  let url = "";
  try {
    const c = document.createElement("canvas");
    c.width = c.height = px;
    if (drawBlockIcon(c.getContext("2d")!, blockName, px, provider)) url = c.toDataURL("image/png");
  } catch {
    url = "";
  }
  urlCache.set(key, url);
  return url || null;
}
