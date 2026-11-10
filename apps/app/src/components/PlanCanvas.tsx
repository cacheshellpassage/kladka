import { useEffect, useRef, useState } from "react";
import type { VoxelModel } from "@kladka/voxel-core";
import { drawPlan, planColors, stepRegion, type LegendEntry, type PlanSymbols } from "../lib/plan2d";
import { nameOf } from "../lib/format";
import { useT } from "../i18n";
import { effectiveTheme, useSettings } from "../store/settings";
import { Icon } from "./Icon";

/** Free space between the edge of the pane and the drawing (px). */
const PAD = 8;
/** Cells never get bigger than this, however far the plan is zoomed in (px). */
const MAX_CELL = 72;
const TAP_MOVE = 8;
const TAP_TIME = 300;
const DOUBLE_TAP_TIME = 320;
const DOUBLE_TAP_MOVE = 30;

/** What the plan shows: the size of a cell and the cell of the layer that sits in the middle of the pane. */
interface View {
  cell: number;
  cx: number;
  cz: number;
}

/** How the last frame was laid out: enough to turn a point of the pane into a cell of the layer. */
interface Frame {
  cell: number;
  margin: number;
  left: number;
  top: number;
  fromX: number;
  fromZ: number;
  view: View;
  pannable: boolean;
}

const marginFor = (cell: number) => Math.max(18, Math.min(30, Math.round(cell * 1.2)));

/** The largest whole cell at which `cols` × `rows` cells with their rulers fit into w × h. */
function fitCell(w: number, h: number, cols: number, rows: number, lo: number, hi: number): number {
  let cell = Math.min(hi, Math.floor(Math.min((w - 26) / cols, (h - 26) / rows)));
  while (cell > lo && (marginFor(cell) + cols * cell + 8 > w || marginFor(cell) + rows * cell + 8 > h))
    cell--;
  return Math.max(lo, cell);
}

/**
 * The 2D plan of one layer. It opens on the whole layer (or, with `focus`, on the blocks of the current
 * step) and can be moved like a map: pinch or the mouse wheel to zoom, drag to pan, double tap to zoom in
 * and back. Only the visible window is drawn, so the rulers with real coordinates stay at the edge.
 */
export function PlanCanvas({
  model,
  stepOf,
  y,
  currentStep,
  onLegend,
  label,
  focus = false,
  symbols,
  swipeThrough = false,
}: {
  model: VoxelModel;
  stepOf: Int32Array | null;
  y: number;
  currentStep: number | null;
  onLegend?: (l: LegendEntry[]) => void;
  label: string;
  /** Open on the blocks of the current step (with a few cells of context) instead of the whole layer. */
  focus?: boolean;
  /** Letters shared by the whole build (see planSymbols). */
  symbols?: PlanSymbols;
  /**
   * The screen around the plan listens for swipes: until the plan is zoomed by hand, a drag with one finger
   * is left to that screen and does not move the plan.
   */
  swipeThrough?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const dark = useSettings((s) => effectiveTheme(s.theme) === "dark");
  /** The view chosen by hand; null while the plan shows its home view. */
  const view = useRef<View | null>(null);
  const last = useRef<{ model: VoxelModel | null; focus: boolean; step: number | null; y: number }>({
    model: null,
    focus,
    step: null,
    y,
  });
  const goHome = useRef<() => void>(() => {});
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const h = host.current,
      c = canvas.current;
    if (!h || !c) return;
    const { x: sx, z: sz } = model.size;
    const prev = last.current;
    if (prev.model !== model || prev.focus !== focus) view.current = null;
    const stepChanged = prev.step !== currentStep || prev.y !== y;
    last.current = { model, focus, step: currentStep, y };

    const size = () => ({
      w: Math.max(160, h.clientWidth - 2 * PAD),
      h: Math.max(160, h.clientHeight - 2 * PAD),
    });
    // small cells drop the letters but keep the whole layer on screen, which matters more on a phone
    const minCell = () => {
      const s = size();
      return fitCell(s.w, s.h, sx, sz, 5, 30);
    };
    const maxCell = () => Math.max(minCell(), MAX_CELL);
    const home = (): View => {
      const s = size();
      const rg = focus && currentStep !== null ? stepRegion(model, stepOf, y, currentStep) : null;
      if (!rg) return { cell: fitCell(s.w, s.h, sx, sz, 5, 30), cx: sx / 2, cz: sz / 2 };
      return {
        cell: fitCell(s.w, s.h, rg.x1 - rg.x0, rg.z1 - rg.z0, 10, 56),
        cx: (rg.x0 + rg.x1) / 2,
        cz: (rg.z0 + rg.z1) / 2,
      };
    };

    /** Cells of one axis that are on screen and where the drawing starts (px from the edge of the pane). */
    const axis = (avail: number, n: number, centre: number, cell: number, margin: number, snap: boolean) => {
      const cap = (avail - margin - 8) / cell;
      if (n <= cap)
        return { from: 0, to: n, at: PAD + (avail - margin - 8 - n * cell) / 2, centre: n / 2, pan: false };
      const inset = ((cap - Math.floor(cap)) * cell) / 2;
      let start = Math.min(n - cap, Math.max(0, centre - cap / 2));
      if (snap) {
        // at rest the window starts on a whole cell, so the rulers are never cut
        const whole = Math.floor(cap);
        start = Math.min(n - whole, Math.max(0, Math.round(start)));
        return { from: start, to: start + whole, at: PAD + inset, centre: start + cap / 2, pan: true };
      }
      const from = Math.floor(start);
      return {
        from,
        to: Math.min(n, Math.ceil(start + cap)),
        at: PAD + inset - (start - from) * cell,
        centre: start + cap / 2,
        pan: true,
      };
    };

    let frame: Frame | null = null;
    const draw = (snap: boolean, withLegend = false) => {
      const v = view.current ?? home();
      const s = size();
      const cell = Math.round(v.cell);
      const margin = marginFor(cell);
      const ax = axis(s.w, sx, v.cx, cell, margin, snap);
      const az = axis(s.h, sz, v.cz, cell, margin, snap);
      const w = margin + (ax.to - ax.from) * cell + 8,
        hh = margin + (az.to - az.from) * cell + 8;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.ceil(w * dpr);
      c.height = Math.ceil(hh * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${hh}px`;
      c.style.transform = `translate(${ax.at}px, ${az.at}px)`;
      const pannable = ax.pan || az.pan;
      frame = {
        cell,
        margin,
        left: ax.at,
        top: az.at,
        fromX: ax.from,
        fromZ: az.from,
        view: { cell: v.cell, cx: ax.centre, cz: az.centre },
        pannable,
      };
      // dragging past the edge does not pile up: the view is where the drawing really is
      if (view.current) {
        view.current.cx = ax.centre;
        view.current.cz = az.centre;
      }
      if (pannable && (!swipeThrough || view.current)) h.dataset.grab = "1";
      else delete h.dataset.grab;
      setMoved(view.current !== null);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const r = drawPlan(ctx, {
        model,
        stepOf,
        y,
        currentStep,
        cell,
        colors: planColors(dark),
        nameOf: nameOf(locale),
        margin,
        region: { x0: ax.from, z0: az.from, x1: ax.to, z1: az.to },
        symbols,
      });
      if (withLegend) onLegend?.(r.legend);
    };

    // a view chosen by hand stays when the step changes, unless the new step is somewhere else entirely
    if (view.current && stepChanged && currentStep !== null) {
      const box = stepRegion(model, stepOf, y, currentStep, 0, 1);
      if (box) {
        const v = view.current;
        const s = size();
        const cell = Math.round(v.cell);
        const ax = axis(s.w, sx, v.cx, cell, marginFor(cell), false);
        const az = axis(s.h, sz, v.cz, cell, marginFor(cell), false);
        if (box.x1 <= ax.from || box.x0 >= ax.to || box.z1 <= az.from || box.z0 >= az.to) {
          v.cx = (box.x0 + box.x1) / 2;
          v.cz = (box.z0 + box.z1) / 2;
        }
      }
    }
    draw(true, true);

    /** The view the gestures change: it starts from what is on screen now. */
    const mine = (): View => (view.current ??= { ...(frame?.view ?? home()) });
    const cellAt = (px: number, py: number) => ({
      x: frame ? frame.fromX + (px - frame.left - frame.margin) / frame.cell : sx / 2,
      z: frame ? frame.fromZ + (py - frame.top - frame.margin) / frame.cell : sz / 2,
    });
    /** Puts cell `g` of the layer under point (px, py) of the pane at the given cell size. */
    const place = (g: { x: number; z: number }, px: number, py: number, size1: number) => {
      const v = mine();
      v.cell = Math.min(maxCell(), Math.max(minCell(), size1));
      const s = size();
      const cell = Math.round(v.cell);
      const margin = marginFor(cell);
      const centre = (avail: number, n: number, at: number, p: number) => {
        const cap = (avail - margin - 8) / cell;
        if (n <= cap) return n / 2;
        const inset = ((cap - Math.floor(cap)) * cell) / 2;
        return at - (p - PAD - inset - margin) / cell + cap / 2;
      };
      v.cx = centre(s.w, sx, g.x, px);
      v.cz = centre(s.h, sz, g.z, py);
    };
    /** A gesture is over: back to whole cells, and a layer that fits again is simply the home view. */
    const settle = () => {
      draw(true);
      if (view.current && !focus && !frame?.pannable && view.current.cell <= minCell() + 0.5) {
        view.current = null;
        draw(true);
      }
    };
    goHome.current = () => {
      view.current = null;
      draw(true);
    };

    let raf = 0;
    const redraw = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        draw(false);
      });
    };
    const point = (e: { clientX: number; clientY: number }) => {
      const r = h.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const pts = new Map<number, { x: number; y: number }>();
    /** What the fingers hold: a cell of the layer, and for a pinch the distance and cell size at its start. */
    let grip: { g: { x: number; z: number }; dist: number; cell: number } | null = null;
    let tap: { x: number; y: number; t: number; still: boolean } | null = null;
    let lastTap: { x: number; y: number; t: number } | null = null;
    const hold = () => {
      const all = [...pts.values()];
      if (all.length >= 2) {
        const [a, b] = all as [{ x: number; y: number }, { x: number; y: number }];
        const mx = (a.x + b.x) / 2,
          my = (a.y + b.y) / 2;
        grip = { g: cellAt(mx, my), dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), cell: mine().cell };
      } else if (all.length === 1 && frame?.pannable && (!swipeThrough || view.current)) {
        grip = { g: cellAt(all[0]!.x, all[0]!.y), dist: 0, cell: (view.current ?? frame.view).cell };
      } else grip = null;
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if ((e.target as Element).closest("button")) return;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      draw(false); // the cell under the finger is read from what is on screen
      const p = point(e);
      pts.set(e.pointerId, p);
      try {
        h.setPointerCapture(e.pointerId);
      } catch {
        /* the pointer is already gone */
      }
      tap = pts.size === 1 ? { ...p, t: performance.now(), still: true } : null;
      hold();
    };
    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const p = point(e);
      pts.set(e.pointerId, p);
      if (tap && Math.hypot(p.x - tap.x, p.y - tap.y) > TAP_MOVE) tap.still = false;
      if (!grip || (tap && tap.still)) return;
      const all = [...pts.values()];
      if (all.length >= 2) {
        const [a, b] = all as [{ x: number; y: number }, { x: number; y: number }];
        const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        place(grip.g, (a.x + b.x) / 2, (a.y + b.y) / 2, (grip.cell * dist) / grip.dist);
      } else place(grip.g, p.x, p.y, grip.cell);
      redraw();
    };
    const onUp = (e: PointerEvent) => {
      if (!pts.delete(e.pointerId)) return;
      const p = point(e);
      const now = performance.now();
      const wasTap = e.type === "pointerup" && tap !== null && tap.still && now - tap.t < TAP_TIME;
      if (pts.size > 0) {
        hold(); // one finger of a pinch is still down: it goes on as a drag
        return;
      }
      grip = null;
      tap = null;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (wasTap) {
        const double =
          lastTap !== null &&
          now - lastTap.t < DOUBLE_TAP_TIME &&
          Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < DOUBLE_TAP_MOVE;
        lastTap = double ? null : { ...p, t: now };
        if (double) {
          if (view.current) view.current = null;
          else if (frame) {
            const target = Math.min(maxCell(), Math.max(frame.cell * 2, 24));
            // already as close as it gets (a small step seen up close): show the whole layer instead
            place(cellAt(p.x, p.y), p.x, p.y, target > frame.cell * 1.15 ? target : minCell());
          }
        }
      }
      settle();
    };
    let wheelEnd = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = point(e);
      const from = (view.current ?? frame?.view ?? home()).cell;
      const delta = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
      place(cellAt(p.x, p.y), p.x, p.y, from * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0025)));
      draw(false);
      window.clearTimeout(wheelEnd);
      wheelEnd = window.setTimeout(settle, 180);
    };

    h.addEventListener("pointerdown", onDown);
    h.addEventListener("pointermove", onMove);
    h.addEventListener("pointerup", onUp);
    h.addEventListener("pointercancel", onUp);
    h.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(() => draw(true));
    ro.observe(h);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(wheelEnd);
      h.removeEventListener("pointerdown", onDown);
      h.removeEventListener("pointermove", onMove);
      h.removeEventListener("pointerup", onUp);
      h.removeEventListener("pointercancel", onUp);
      h.removeEventListener("wheel", onWheel);
    };
  }, [model, stepOf, y, currentStep, dark, locale, onLegend, focus, symbols, swipeThrough]);

  return (
    <div className="plan-host" ref={host}>
      <canvas ref={canvas} role="img" aria-label={label} />
      {moved ? (
        <button
          className="btn icon plan-reset"
          type="button"
          onClick={() => goHome.current()}
          aria-label={t("guide.plan.reset")}
          title={t("guide.plan.reset")}
        >
          <Icon name="reset" size={18} />
        </button>
      ) : null}
    </div>
  );
}
