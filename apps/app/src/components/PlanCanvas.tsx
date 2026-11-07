import { useEffect, useRef } from "react";
import type { VoxelModel } from "@kladka/voxel-core";
import { drawPlan, planColors, type LegendEntry } from "../lib/plan2d";
import { nameOf } from "../lib/format";
import { effectiveTheme, useSettings } from "../store/settings";

export function PlanCanvas({
  model,
  stepOf,
  y,
  currentStep,
  onLegend,
  label,
}: {
  model: VoxelModel;
  stepOf: Int32Array | null;
  y: number;
  currentStep: number | null;
  onLegend?: (l: LegendEntry[]) => void;
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const locale = useSettings((s) => s.locale);
  const dark = useSettings((s) => effectiveTheme(s.theme) === "dark");

  useEffect(() => {
    const draw = () => {
      const c = canvas.current,
        h = host.current;
      if (!c || !h) return;
      const avail = Math.max(160, h.clientWidth - 16);
      const availH = Math.max(160, h.clientHeight - 16);
      const cell = Math.max(
        10,
        Math.min(30, Math.floor(Math.min((avail - 30) / model.size.x, (availH - 30) / model.size.z))),
      );
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const margin = Math.max(18, Math.round(cell * 1.2));
      const w = margin + model.size.x * cell + 8,
        hh = margin + model.size.z * cell + 8;
      c.width = Math.ceil(w * dpr);
      c.height = Math.ceil(hh * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${hh}px`;
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
      });
      onLegend?.(r.legend);
    };
    draw();
    const ro = new ResizeObserver(draw);
    if (host.current) ro.observe(host.current);
    return () => ro.disconnect();
  }, [model, stepOf, y, currentStep, dark, locale, onLegend]);

  return (
    <div className="plan-host" ref={host}>
      <canvas ref={canvas} role="img" aria-label={label} />
    </div>
  );
}
