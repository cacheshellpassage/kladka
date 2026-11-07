/**
 * Per-palette render information: block knowledge + texture layer indices in the atlas.
 * Textures come from the procedural generator or, if supplied, from a user texture provider
 * (e.g. a resource pack the user loaded locally).
 */
import {
  blockInfo,
  shapeGeometry,
  texKey,
  type BlockInfo,
  type PaletteEntry,
  type ShapeGeometry,
  type TexDef,
} from "@kladka/voxel-core";
import { TEX, generateTexture } from "./textures";

export type FaceSlot = "top" | "side" | "bottom";

/** Optional source of real textures (16×16 RGBA, bottom-up rows) for a block face. */
export interface TextureProvider {
  /** Returns RGBA pixels (TEX×TEX×4) or undefined to fall back to procedural textures. */
  get(blockName: string, slot: FaceSlot, material: string): Uint8Array | undefined;
  readonly id: string;
}

export interface PaletteRender {
  info: BlockInfo;
  geometry: ShapeGeometry;
  layers: Record<FaceSlot, number>;
  glowLayer: number;
  tintLayers: Map<number, number>;
  /** Swap UVs on these faces (horizontal logs). */
  axis: "x" | "y" | "z";
  /** 0..1 emission */
  emissive: number;
  greedy: boolean;
}

export interface AtlasData {
  layers: Uint8Array[];
  keys: string[];
}

export class AtlasBuilder {
  private index = new Map<string, number>();
  readonly layers: Uint8Array[] = [];
  constructor(private provider: TextureProvider | null) {}

  layerFor(def: TexDef, blockName?: string, slot?: FaceSlot, material?: string): number {
    if (this.provider && blockName && slot) {
      const key = `rp:${blockName}:${slot}`;
      const hit = this.index.get(key);
      if (hit !== undefined) return hit;
      const px = this.provider.get(blockName, slot, material ?? "");
      if (px && px.length === TEX * TEX * 4) {
        this.index.set(key, this.layers.length);
        this.layers.push(px);
        return this.layers.length - 1;
      }
    }
    const key = texKey(def);
    const hit = this.index.get(key);
    if (hit !== undefined) return hit;
    this.index.set(key, this.layers.length);
    this.layers.push(generateTexture(def));
    return this.layers.length - 1;
  }
}

export function buildPaletteRender(
  palette: PaletteEntry[],
  provider: TextureProvider | null,
): { table: PaletteRender[]; atlas: AtlasBuilder } {
  const atlas = new AtlasBuilder(provider);
  // layer 0: white (used for untextured details)
  atlas.layerFor({ pattern: "plain", color: 0xffffff, accent: 0xffffff });
  const table = palette.map((p) => {
    const info = blockInfo(p.name);
    const geometry = shapeGeometry(p, info);
    const layers: Record<FaceSlot, number> = {
      top: atlas.layerFor(info.tex.top, p.name, "top", info.material),
      side: atlas.layerFor(info.tex.side, p.name, "side", info.material),
      bottom: atlas.layerFor(info.tex.bottom, p.name, "bottom", info.material),
    };
    const glowLayer = atlas.layerFor({
      pattern: "glow",
      color: info.tex.side.accent ?? 0xffd860,
      accent: 0xffffff,
    });
    const tintLayers = new Map<number, number>();
    for (const b of geometry.boxes) {
      if (b.tint !== undefined && !tintLayers.has(b.tint)) {
        tintLayers.set(b.tint, atlas.layerFor({ pattern: "leaves", color: b.tint, accent: b.tint }));
      }
    }
    const axis = (p.props.axis as "x" | "y" | "z" | undefined) ?? "y";
    return {
      info,
      geometry,
      layers,
      glowLayer,
      tintLayers,
      axis,
      emissive: info.emissive,
      greedy: info.shape === "cube" && info.render !== "none",
    } satisfies PaletteRender;
  });
  return { table, atlas };
}
