/** 2D layer plan rendering (canvas): grid, coordinates, block colours, symbols and step state. */
import { blockInfo, layerGrid, shortId, type VoxelModel } from "@kladka/voxel-core";

export interface PlanColors {
  bg: string;
  grid: string;
  gridStrong: string;
  text: string;
  ghost: string;
  accent: string;
  future: string;
}

export interface LegendEntry {
  palette: number;
  symbol: string;
  color: string;
  name: string;
  count: number;
}

const SYMBOLS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, "0")}`;
}

function luminance(c: number): number {
  const r = (c >> 16) & 255,
    g = (c >> 8) & 255,
    b = c & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export interface DrawPlanOptions {
  model: VoxelModel;
  stepOf: Int32Array | null;
  y: number;
  currentStep: number | null;
  cell: number;
  colors: PlanColors;
  nameOf: (blockName: string) => string;
  /** Margin for axis labels (px). */
  margin?: number;
  title?: string;
}

export function legendFor(model: VoxelModel, y: number, nameOf: (n: string) => string): LegendEntry[] {
  const g = layerGrid(model, null, y);
  const counts = new Map<number, number>();
  for (const p of g.cells) if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([palette, count], i) => {
      const st = model.palette[palette]!;
      return {
        palette,
        count,
        symbol: SYMBOLS[i % SYMBOLS.length]!,
        color: hex(blockInfo(st.name).color),
        name: nameOf(st.name),
      };
    });
}

/** Draws the plan; returns the canvas size actually used. */
export function drawPlan(
  ctx: CanvasRenderingContext2D,
  o: DrawPlanOptions,
): { width: number; height: number; legend: LegendEntry[] } {
  const { model, y, cell, colors } = o;
  const margin = o.margin ?? Math.max(18, Math.round(cell * 1.2));
  const top = o.title ? margin + 22 : margin;
  const W = model.size.x,
    D = model.size.z;
  const width = margin + W * cell + 8;
  const height = top + D * cell + 8;
  const grid = layerGrid(model, null, y);
  const legend = legendFor(model, y, o.nameOf);
  const sym = new Map(legend.map((l) => [l.palette, l.symbol]));
  ctx.save();
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);
  if (o.title) {
    ctx.fillStyle = colors.text;
    ctx.font = `600 15px system-ui, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(o.title, margin, 6);
  }
  ctx.translate(margin, top);
  // ghost of the layer below
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++) {
      const c = x + z * W;
      if (!grid.cells[c] && grid.below[c]) {
        ctx.fillStyle = colors.ghost;
        ctx.fillRect(x * cell, z * cell, cell, cell);
      }
    }
  // blocks
  const fontSize = Math.max(8, Math.floor(cell * 0.55));
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++) {
      const c = x + z * W;
      const p = grid.cells[c]!;
      if (!p) continue;
      const st = model.palette[p]!;
      const info = blockInfo(st.name);
      const idx = model.index(x, y, z);
      const step = o.stepOf ? o.stepOf[idx]! : -1;
      const future = o.currentStep !== null && step > o.currentStep;
      const current = o.currentStep !== null && step === o.currentStep;
      const px = x * cell,
        pz = z * cell;
      if (future) {
        ctx.strokeStyle = colors.future;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 2.5, pz + 2.5, cell - 5, cell - 5);
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = hex(info.color);
        if (info.shape === "slab" && st.props.type !== "double") {
          const h = cell / 2;
          ctx.fillRect(px + 1, pz + (st.props.type === "top" ? 1 : h), cell - 2, h - 1);
          ctx.globalAlpha = 0.35;
          ctx.fillRect(px + 1, pz + 1, cell - 2, cell - 2);
          ctx.globalAlpha = 1;
        } else if (
          info.shape === "cube" ||
          info.shape === "stairs" ||
          info.shape === "path" ||
          info.shape === "chest"
        ) {
          ctx.fillRect(px + 1, pz + 1, cell - 2, cell - 2);
        } else {
          ctx.globalAlpha = 0.85;
          ctx.fillRect(px + cell * 0.2, pz + cell * 0.2, cell * 0.6, cell * 0.6);
          ctx.globalAlpha = 1;
        }
        // stairs arrow (points up the stairs, i.e. towards `facing`)
        if (info.shape === "stairs" && cell >= 10) {
          const f = st.props.facing ?? "north";
          const cx = px + cell / 2,
            cz = pz + cell / 2;
          const d = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[f as "north"] ?? [0, -1];
          ctx.strokeStyle = luminance(info.color) > 0.5 ? "#000a" : "#fffa";
          ctx.lineWidth = Math.max(1, cell / 10);
          ctx.beginPath();
          ctx.moveTo(cx - d[0]! * cell * 0.3, cz - d[1]! * cell * 0.3);
          ctx.lineTo(cx + d[0]! * cell * 0.3, cz + d[1]! * cell * 0.3);
          ctx.lineTo(
            cx + d[0]! * cell * 0.3 - (d[0]! + d[1]!) * cell * 0.15,
            cz + d[1]! * cell * 0.3 - (d[1]! - d[0]!) * cell * 0.15,
          );
          ctx.stroke();
        } else if (cell >= 14) {
          ctx.fillStyle = luminance(info.color) > 0.55 ? "#111" : "#fff";
          ctx.fillText(sym.get(p) ?? "?", px + cell / 2, pz + cell / 2 + 1);
        }
      }
      if (current) {
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = Math.max(2, cell / 8);
        ctx.strokeRect(px + 1, pz + 1, cell - 2, cell - 2);
      }
    }
  // grid
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x++) {
    ctx.strokeStyle = x % 5 === 0 ? colors.gridStrong : colors.grid;
    ctx.beginPath();
    ctx.moveTo(x * cell + 0.5, 0);
    ctx.lineTo(x * cell + 0.5, D * cell);
    ctx.stroke();
  }
  for (let z = 0; z <= D; z++) {
    ctx.strokeStyle = z % 5 === 0 ? colors.gridStrong : colors.grid;
    ctx.beginPath();
    ctx.moveTo(0, z * cell + 0.5);
    ctx.lineTo(W * cell, z * cell + 0.5);
    ctx.stroke();
  }
  // axis labels
  ctx.fillStyle = colors.text;
  ctx.font = `${Math.max(9, Math.min(12, cell * 0.6))}px system-ui, sans-serif`;
  const every = cell >= 18 ? 1 : cell >= 10 ? 5 : 10;
  for (let x = 0; x < W; x++) if (x % every === 0) ctx.fillText(String(x), x * cell + cell / 2, -margin / 2);
  ctx.textAlign = "right";
  for (let z = 0; z < D; z++) if (z % every === 0) ctx.fillText(String(z), -4, z * cell + cell / 2);
  ctx.restore();
  return { width, height, legend };
}

export function planColors(dark: boolean): PlanColors {
  return dark
    ? {
        bg: "#1b1e25",
        grid: "#2c313b",
        gridStrong: "#465061",
        text: "#c9ced8",
        ghost: "#ffffff14",
        accent: "#ffb347",
        future: "#6b7a99",
      }
    : {
        bg: "#ffffff",
        grid: "#e3e7ee",
        gridStrong: "#b7c0cf",
        text: "#3a4150",
        ghost: "#00000012",
        accent: "#e0622b",
        future: "#9aa7bf",
      };
}

export { shortId };
