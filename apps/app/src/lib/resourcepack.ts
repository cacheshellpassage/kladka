/**
 * User resource packs: reads a resource-pack .zip or a client.jar *locally* and provides 16×16 block
 * textures to the viewer. Nothing is uploaded or bundled; the user's file never leaves the device.
 */
import { unzip } from "fflate";
import type { FaceSlot, TextureProvider } from "@kladka/viewer";

const PREFIX = "assets/minecraft/textures/block/";

export interface LoadedPack {
  name: string;
  textures: Record<string, Uint8Array>; // file name (without .png) → RGBA 16×16 (bottom-up)
}

function unzipAsync(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) =>
    unzip(
      bytes,
      {
        filter: (f) =>
          f.name.startsWith(PREFIX) && f.name.endsWith(".png") && !f.name.slice(PREFIX.length).includes("/"),
      },
      (err, data) => (err ? reject(err) : resolve(data)),
    ),
  );
}

async function pngToRgba16(png: Uint8Array): Promise<Uint8Array | null> {
  const blob = new Blob([png as BlobPart], { type: "image/png" });
  const bmp = await createImageBitmap(blob);
  // animated textures are vertical strips: use the first frame
  const size = bmp.width;
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = size > 16;
  ctx.drawImage(bmp, 0, 0, size, size, 0, 0, 16, 16);
  bmp.close?.();
  const data = ctx.getImageData(0, 0, 16, 16).data;
  // flip rows: viewer textures are stored bottom-up
  const out = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) out.set(data.subarray((15 - y) * 64, (16 - y) * 64), y * 64);
  return out;
}

export async function loadResourcePack(file: File): Promise<LoadedPack> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = await unzipAsync(bytes);
  const textures: Record<string, Uint8Array> = {};
  for (const [path, png] of Object.entries(entries)) {
    const name = path.slice(PREFIX.length, -4);
    try {
      const rgba = await pngToRgba16(png);
      if (rgba) textures[name] = rgba;
    } catch {
      /* skip broken images */
    }
  }
  return { name: file.name, textures };
}

/** Grass/leaves textures in vanilla-style packs are grey and tinted by biome colour at runtime. */
const TINT: Record<string, [number, number, number]> = {
  grass_block_top: [124, 189, 107],
  oak_leaves: [96, 161, 64],
  jungle_leaves: [70, 170, 40],
  acacia_leaves: [110, 150, 50],
  dark_oak_leaves: [80, 140, 50],
  mangrove_leaves: [100, 150, 60],
  spruce_leaves: [97, 153, 97],
  birch_leaves: [128, 167, 85],
  vine: [96, 161, 64],
  short_grass: [124, 189, 107],
  tall_grass_top: [124, 189, 107],
  tall_grass_bottom: [124, 189, 107],
  fern: [124, 189, 107],
  lily_pad: [32, 128, 48],
};

function tinted(name: string, px: Uint8Array): Uint8Array {
  const t = TINT[name];
  if (!t) return px;
  const out = px.slice();
  for (let i = 0; i < out.length; i += 4) {
    out[i] = (out[i]! * t[0]) / 255;
    out[i + 1] = (out[i + 1]! * t[1]) / 255;
    out[i + 2] = (out[i + 2]! * t[2]) / 255;
  }
  return out;
}

/** Maps our (block, face slot, material) to texture file names using common naming conventions. */
export function createProvider(pack: LoadedPack): TextureProvider {
  const t = pack.textures;
  const find = (...names: string[]) => {
    for (const n of names) if (t[n]) return tinted(n, t[n]!);
    return undefined;
  };
  return {
    id: `rp:${pack.name}:${Object.keys(t).length}`,
    get(blockName: string, slot: FaceSlot, material: string) {
      const id = blockName.replace(/^minecraft:/, "");
      const mat = material.replace(/^minecraft:/, "");
      if (id === "grass_block")
        return slot === "top"
          ? find("grass_block_top")
          : slot === "side"
            ? find("grass_block_side")
            : find("dirt");
      if (/_(log|stem|wood|hyphae)$/.test(id) || id.endsWith("bamboo_block")) {
        const base = id.replace(/_wood$/, "_log").replace(/_hyphae$/, "_stem");
        if (slot === "side" || /_(wood|hyphae)$/.test(id)) return find(base);
        return find(`${base}_top`, base);
      }
      if (id.endsWith("_door")) return find(`${id}_bottom`, `${id}_lower`, mat);
      if (id.endsWith("_trapdoor")) return find(id);
      if (id.endsWith("_bed")) return find(mat, mat.replace(/_bed$/, "_wool"));
      if (id === "wall_torch" || id === "soul_wall_torch") return find(id.replace("wall_", ""));
      const direct = find(`${id}_${slot}`, slot === "bottom" ? `${id}_top` : "", id);
      if (direct) return direct;
      if (slot === "top" || slot === "bottom") {
        const m = find(`${mat}_top`, mat);
        if (m) return m;
      }
      return find(`${mat}_side`, mat);
    },
  };
}
