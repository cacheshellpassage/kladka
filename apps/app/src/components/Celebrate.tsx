/** Celebration overlay with a lightweight canvas confetti burst (no dependencies). */
import { useEffect, useRef } from "react";
import { useT } from "../i18n";

const COLORS = ["#2563eb", "#6b9dff", "#3448c5", "#93c5fd", "#4cc38a", "#f5c542", "#ffffff"];

export function Celebrate({
  title,
  text,
  emoji,
  onClose,
  big = false,
}: {
  title: string;
  text: string;
  emoji: string;
  onClose: () => void;
  big?: boolean;
}) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || reduce) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const n = big ? 160 : 80;
    const parts = Array.from({ length: n }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: innerHeight * 0.45,
      vx: (Math.random() - 0.5) * (big ? 16 : 11),
      vy: -Math.random() * (big ? 16 : 12) - 4,
      s: 5 + Math.random() * 6,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      cube: Math.random() < 0.5,
    }));
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const age = now - start;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.38;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age / 2600);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        if (p.cube) ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
        else ctx.fillRect(-p.s / 2, -p.s / 5, p.s, p.s / 2.5);
        ctx.restore();
      }
      if (age < 2600) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [big]);

  useEffect(() => {
    const h = setTimeout(onClose, big ? 6000 : 3200);
    return () => clearTimeout(h);
  }, [onClose, big]);

  return (
    <div className="celebrate" role="status" aria-live="polite">
      <canvas ref={canvas} />
      <div className="badge-card" onClick={onClose}>
        <span className="emoji" aria-hidden="true">
          {emoji}
        </span>
        <h2>{title}</h2>
        <p className="muted" style={{ margin: "0 0 12px" }}>
          {text}
        </p>
        <button className="btn primary" type="button" onClick={onClose}>
          {t("common.continue")}
        </button>
      </div>
    </div>
  );
}
