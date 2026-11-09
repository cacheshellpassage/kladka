/**
 * Chunk mesher (pure TypeScript, no three.js dependency – testable in Node).
 *
 * - Full cubes are greedy-meshed per face direction; merge key = palette + per-corner AO + build step.
 * - Other shapes are emitted box by box (or as crossed planes for plants).
 * - Step-aware culling: a face is removed only if the neighbour is an opaque cube built at the same or
 *   an earlier step, so every intermediate build state is watertight without remeshing.
 * - Clip box: blocks outside are treated as air (used for section views; affected chunks are rebuilt).
 *
 * Vertex layout: position(3) normal(3) color(3: AO) tex(3: u, v, atlasLayer) data(4: step, palette, glow, role)
 */
import type { VoxelModel } from "@kladka/voxel-core";
import type { FaceSlot, PaletteRender } from "./palette-render";

export const CHUNK = 32;

export interface MeshBuffers {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  tex: Float32Array;
  data: Float32Array;
  indices: Uint32Array;
}

export type RenderPass = "opaque" | "cutout" | "translucent";

export type ChunkMesh = Partial<Record<RenderPass, MeshBuffers>>;

export interface ClipBox {
  min: [number, number, number];
  /** exclusive */
  max: [number, number, number];
}

export interface MeshInput {
  model: VoxelModel;
  table: PaletteRender[];
  stepOf: Int32Array | null;
  roles: Uint8Array | null;
  clip: ClipBox | null;
}

const AO_CURVE = [0.5, 0.68, 0.84, 1.0];

class Builder {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  tex: number[] = [];
  dat: number[] = [];
  idx: number[] = [];
  vcount = 0;

  quad(
    corners: number[][],
    normal: [number, number, number],
    uvs: number[][],
    layer: number,
    ao: number[],
    step: number,
    pal: number,
    glow: number,
    role: number,
    flip = false,
  ): void {
    const base = this.vcount;
    for (let k = 0; k < 4; k++) {
      const c = corners[k]!;
      this.pos.push(c[0]!, c[1]!, c[2]!);
      this.nrm.push(normal[0], normal[1], normal[2]);
      const a = ao[k]!;
      this.col.push(a, a, a);
      const uv = uvs[k]!;
      this.tex.push(uv[0]!, uv[1]!, layer);
      this.dat.push(step, pal, glow, role);
    }
    if (flip) this.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    else this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.vcount += 4;
  }

  build(): MeshBuffers | undefined {
    if (this.vcount === 0) return undefined;
    return {
      positions: new Float32Array(this.pos),
      normals: new Float32Array(this.nrm),
      colors: new Float32Array(this.col),
      tex: new Float32Array(this.tex),
      data: new Float32Array(this.dat),
      indices: new Uint32Array(this.idx),
    };
  }
}

type FaceName = "east" | "west" | "up" | "down" | "south" | "north";

// d axis, sign → face name
const FACE_OF: FaceName[][] = [
  ["west", "east"],
  ["down", "up"],
  ["north", "south"],
];

function slotFor(face: FaceName, axis: "x" | "y" | "z"): FaceSlot {
  if (axis === "y") return face === "up" ? "top" : face === "down" ? "bottom" : "side";
  if (axis === "x") return face === "east" || face === "west" ? "top" : "side";
  return face === "north" || face === "south" ? "top" : "side";
}

function swapUV(face: FaceName, axis: "x" | "y" | "z"): boolean {
  if (axis === "x") return face === "up" || face === "down" || face === "north" || face === "south";
  if (axis === "z") return face === "east" || face === "west";
  return false;
}

/** UV (in block units) for a world-space point on a face with normal axis d. */
function uvFor(d: number, p: number[], swap: boolean): [number, number] {
  let u: number, v: number;
  if (d === 0) {
    u = p[2]!;
    v = p[1]!;
  } else if (d === 1) {
    u = p[0]!;
    v = p[2]!;
  } else {
    u = p[0]!;
    v = p[1]!;
  }
  return swap ? [v, u] : [u, v];
}

export function meshChunk(input: MeshInput, cx: number, cy: number, cz: number, size = CHUNK): ChunkMesh {
  const { model: m, table, stepOf, roles, clip } = input;
  const { x: sx, y: sy, z: sz } = m.size;
  const layerSize = sx * sz;
  const blocks = m.blocks;
  const x0 = cx,
    y0 = cy,
    z0 = cz;
  const x1 = Math.min(sx, cx + size),
    y1 = Math.min(sy, cy + size),
    z1 = Math.min(sz, cz + size);

  const cmin = clip ? clip.min : [0, 0, 0];
  const cmax = clip ? clip.max : [sx, sy, sz];
  const inClip = (x: number, y: number, z: number) =>
    x >= cmin[0]! && y >= cmin[1]! && z >= cmin[2]! && x < cmax[0]! && y < cmax[1]! && z < cmax[2]!;
  const pal = (x: number, y: number, z: number): number => {
    if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return 0;
    if (clip && !inClip(x, y, z)) return 0;
    return blocks[x + z * sx + y * layerSize]!;
  };
  const stepAt = (x: number, y: number, z: number) => (stepOf ? stepOf[x + z * sx + y * layerSize]! : 0);
  const opaqueCube = (p: number) => {
    const r = table[p]!;
    return r.greedy && r.info.render === "opaque";
  };
  const aoOcc = (x: number, y: number, z: number) => {
    if (y < 0) return 1; // the ground darkens the bottom edge of the lowest blocks
    const p = pal(x, y, z);
    return p !== 0 && opaqueCube(p) ? 1 : 0;
  };

  const builders: Record<RenderPass, Builder> = {
    opaque: new Builder(),
    cutout: new Builder(),
    translucent: new Builder(),
  };
  const passOf = (r: PaletteRender): RenderPass =>
    r.info.render === "translucent" ? "translucent" : r.info.render === "cutout" ? "cutout" : "opaque";

  /** Is the face of block (p, step) towards neighbour (q, qStep) hidden? */
  const hiddenBy = (p: number, step: number, q: number, qStep: number): boolean => {
    if (q === 0) return false;
    if (qStep > step) return false;
    if (opaqueCube(q)) return true;
    const rq = table[q]!;
    return q === p && rq.greedy; // glass-glass, leaves-leaves
  };

  /* ------------------------- greedy cubes ------------------------- */
  const dims = [x1 - x0, y1 - y0, z1 - z0];
  const lo = [x0, y0, z0];
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const du = dims[u]!,
      dv = dims[v]!;
    const maskKey = new Int32Array(du * dv);
    const maskStep = new Int32Array(du * dv);
    const maskRole = new Uint8Array(du * dv);
    for (let s = -1; s <= 1; s += 2) {
      const face = FACE_OF[d]![s > 0 ? 1 : 0]!;
      const normal: [number, number, number] = [0, 0, 0];
      normal[d] = s;
      for (let k = lo[d]!; k < lo[d]! + dims[d]!; k++) {
        maskKey.fill(-1);
        const p3 = [0, 0, 0];
        for (let b = 0; b < dv; b++)
          for (let a = 0; a < du; a++) {
            p3[d] = k;
            p3[u] = lo[u]! + a;
            p3[v] = lo[v]! + b;
            const [x, y, z] = p3 as [number, number, number];
            const p = pal(x, y, z);
            if (p === 0) continue;
            const r = table[p]!;
            if (!r.greedy) continue;
            const st = stepAt(x, y, z);
            const n3 = [x, y, z];
            n3[d]! += s;
            const q = pal(n3[0]!, n3[1]!, n3[2]!);
            if (hiddenBy(p, st, q, q ? stepAt(n3[0]!, n3[1]!, n3[2]!) : 0)) continue;
            // AO for the 4 corners (u-,v-), (u+,v-), (u+,v+), (u-,v+)
            const occ = (du_: number, dv_: number) => {
              const o = [n3[0]!, n3[1]!, n3[2]!];
              o[u]! += du_;
              o[v]! += dv_;
              return aoOcc(o[0]!, o[1]!, o[2]!);
            };
            const sU0 = occ(-1, 0),
              sU1 = occ(1, 0),
              sV0 = occ(0, -1),
              sV1 = occ(0, 1);
            const ao = (s1: number, s2: number, c: number) => (s1 && s2 ? 0 : 3 - (s1 + s2 + c));
            const a0 = ao(sU0, sV0, occ(-1, -1));
            const a1 = ao(sU1, sV0, occ(1, -1));
            const a2 = ao(sU1, sV1, occ(1, 1));
            const a3 = ao(sU0, sV1, occ(-1, 1));
            const mi = a + b * du;
            maskKey[mi] = p | (a0 << 16) | (a1 << 18) | (a2 << 20) | (a3 << 22);
            maskStep[mi] = st;
            maskRole[mi] = roles ? roles[x + z * sx + y * layerSize]! : 0;
          }
        // greedy merge
        for (let b = 0; b < dv; b++)
          for (let a = 0; a < du;) {
            const mi = a + b * du;
            const key = maskKey[mi]!;
            if (key < 0) {
              a++;
              continue;
            }
            const st = maskStep[mi]!;
            let w = 1;
            while (a + w < du && maskKey[mi + w] === key && maskStep[mi + w] === st) w++;
            let h = 1;
            outer: while (b + h < dv) {
              for (let t = 0; t < w; t++) {
                const mj = a + t + (b + h) * du;
                if (maskKey[mj] !== key || maskStep[mj] !== st) break outer;
              }
              h++;
            }
            const p = key & 0xffff;
            const r = table[p]!;
            const aoV = [(key >> 16) & 3, (key >> 18) & 3, (key >> 20) & 3, (key >> 22) & 3];
            const plane = k + (s > 0 ? 1 : 0);
            const mk = (au: number, bv: number) => {
              const c = [0, 0, 0];
              c[d] = plane;
              c[u] = lo[u]! + au;
              c[v] = lo[v]! + bv;
              return c;
            };
            let corners = [mk(a, b), mk(a + w, b), mk(a + w, b + h), mk(a, b + h)];
            let aos = aoV.map((q) => AO_CURVE[q]!);
            if (s < 0) {
              corners = [corners[0]!, corners[3]!, corners[2]!, corners[1]!];
              aos = [aos[0]!, aos[3]!, aos[2]!, aos[1]!];
            }
            const swap = swapUV(face, r.axis);
            const uvs = corners.map((c) => uvFor(d, c, swap));
            const layer = r.layers[slotFor(face, r.axis)];
            const flip = aos[0]! + aos[2]! < aos[1]! + aos[3]!;
            builders[passOf(r)].quad(
              corners,
              normal,
              uvs,
              layer,
              aos,
              st,
              p,
              r.emissive,
              maskRole[mi]!,
              flip,
            );
            for (let hh = 0; hh < h; hh++)
              for (let ww = 0; ww < w; ww++) maskKey[a + ww + (b + hh) * du] = -1;
            a += w;
          }
      }
    }
  }

  /* ------------------------- other shapes ------------------------- */
  for (let y = y0; y < y1; y++)
    for (let z = z0; z < z1; z++)
      for (let x = x0; x < x1; x++) {
        const p = pal(x, y, z);
        if (p === 0) continue;
        const r = table[p]!;
        if (r.greedy || r.info.shape === "air") continue;
        const st = stepAt(x, y, z);
        const role = roles ? roles[x + z * sx + y * layerSize]! : 0;
        const bld = builders[passOf(r)];
        const g = r.geometry;
        if (g.planes) {
          emitPlanes(bld, x, y, z, g.planes, g.planeHeight ?? 16, r.layers.side, st, p, r.emissive, role);
        }
        for (const box of g.boxes) {
          const [fx, fy, fz] = box.from;
          const [tx, ty, tz] = box.to;
          const bx0 = x + fx / 16,
            by0 = y + fy / 16,
            bz0 = z + fz / 16;
          const bx1 = x + tx / 16,
            by1 = y + ty / 16,
            bz1 = z + tz / 16;
          const glow = box.glow ? 1 : r.emissive;
          const layerOf = (face: FaceName) =>
            box.glow
              ? r.glowLayer
              : box.tint !== undefined
                ? (r.tintLayers.get(box.tint) ?? 0)
                : r.layers[slotFor(face, r.axis)];
          const target = box.glow && r.info.render === "opaque" ? builders.opaque : bld;
          const lo3 = [bx0, by0, bz0];
          const hi3 = [bx1, by1, bz1];
          const from = [fx, fy, fz];
          const to = [tx, ty, tz];
          for (let d = 0; d < 3; d++) {
            const u = (d + 1) % 3;
            const v = (d + 2) % 3;
            for (const s of [-1, 1]) {
              const face = FACE_OF[d]![s > 0 ? 1 : 0]!;
              // cull faces lying on the block boundary
              const onBoundary = s < 0 ? from[d] === 0 : to[d] === 16;
              if (onBoundary) {
                const n3 = [x, y, z];
                n3[d]! += s;
                const q = pal(n3[0]!, n3[1]!, n3[2]!);
                if (q && opaqueCube(q) && stepAt(n3[0]!, n3[1]!, n3[2]!) <= st) continue;
                if (q === p && r.info.shape === "liquid") continue;
              }
              if (r.info.shape === "liquid" && face !== "up") {
                const n3 = [x, y, z];
                n3[d]! += s;
                const q = pal(n3[0]!, n3[1]!, n3[2]!);
                if (q && table[q]!.info.shape === "liquid") continue;
              }
              const plane = s > 0 ? hi3[d]! : lo3[d]!;
              const mk = (cu: number, cv: number) => {
                const c = [0, 0, 0];
                c[d] = plane;
                c[u] = cu;
                c[v] = cv;
                return c;
              };
              let corners = [
                mk(lo3[u]!, lo3[v]!),
                mk(hi3[u]!, lo3[v]!),
                mk(hi3[u]!, hi3[v]!),
                mk(lo3[u]!, hi3[v]!),
              ];
              if (s < 0) corners = [corners[0]!, corners[3]!, corners[2]!, corners[1]!];
              const swap = swapUV(face, r.axis);
              const uvs = corners.map((c) => {
                const local = [c[0]! - x, c[1]! - y, c[2]! - z].map((q) => Math.min(0.9999, Math.max(0, q)));
                return uvFor(d, local, swap);
              });
              const normal: [number, number, number] = [0, 0, 0];
              normal[d] = s;
              const shadeBottom = face === "down" ? 0.9 : 1;
              target.quad(
                corners,
                normal,
                uvs,
                layerOf(face),
                [shadeBottom, shadeBottom, shadeBottom, shadeBottom],
                st,
                p,
                glow,
                role,
              );
            }
          }
        }
      }

  const out: ChunkMesh = {};
  for (const pass of ["opaque", "cutout", "translucent"] as const) {
    const b = builders[pass].build();
    if (b) out[pass] = b;
  }
  return out;
}

function emitPlanes(
  b: Builder,
  x: number,
  y: number,
  z: number,
  kind: "x" | "hash",
  height: number,
  layer: number,
  step: number,
  pal: number,
  glow: number,
  role: number,
): void {
  const h = height / 16;
  const planes: Array<[number, number, number, number]> =
    kind === "x"
      ? [
          [0.15, 0.15, 0.85, 0.85],
          [0.85, 0.15, 0.15, 0.85],
        ]
      : [
          [0.25, 0, 0.25, 1],
          [0.75, 0, 0.75, 1],
          [0, 0.25, 1, 0.25],
          [0, 0.75, 1, 0.75],
        ];
  const up: [number, number, number] = [0, 1, 0];
  for (const [ax, az, bx, bz] of planes) {
    const c = [
      [x + ax, y, z + az],
      [x + bx, y, z + bz],
      [x + bx, y + h, z + bz],
      [x + ax, y + h, z + az],
    ];
    const uvs = [
      [0, 0],
      [0.9999, 0],
      [0.9999, h * 0.9999],
      [0, h * 0.9999],
    ];
    const ao = [0.85, 0.85, 1, 1];
    b.quad(c, up, uvs, layer, ao, step, pal, glow, role);
    b.quad(
      [c[1]!, c[0]!, c[3]!, c[2]!],
      up,
      [uvs[1]!, uvs[0]!, uvs[3]!, uvs[2]!],
      layer,
      ao,
      step,
      pal,
      glow,
      role,
    );
  }
}

/** Lists chunk origins that contain at least one non-air block. */
export function nonEmptyChunks(m: VoxelModel, size = CHUNK): Array<[number, number, number]> {
  const { x: sx, y: sy, z: sz } = m.size;
  const nx = Math.ceil(sx / size),
    ny = Math.ceil(sy / size),
    nz = Math.ceil(sz / size);
  const flags = new Uint8Array(nx * ny * nz);
  let i = 0;
  for (let y = 0; y < sy; y++) {
    const cyi = Math.floor(y / size);
    for (let z = 0; z < sz; z++) {
      const czi = Math.floor(z / size);
      for (let x = 0; x < sx; x++, i++) {
        if (m.blocks[i] === 0) continue;
        flags[Math.floor(x / size) + czi * nx + cyi * nx * nz] = 1;
      }
    }
  }
  const out: Array<[number, number, number]> = [];
  for (let cy = 0; cy < ny; cy++)
    for (let cz = 0; cz < nz; cz++)
      for (let cx = 0; cx < nx; cx++)
        if (flags[cx + cz * nx + cy * nx * nz]) out.push([cx * size, cy * size, cz * size]);
  return out;
}
