/** Small visual building blocks: fading cover images, decorative cubes, progress ring, skeletons. */
import { useState, type CSSProperties } from "react";

export function CoverImg({ src, alt = "" }: { src?: string; alt?: string }) {
  const [ready, setReady] = useState(false);
  return (
    <div className={`cover-wrap ${ready || !src ? "ready" : ""}`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setReady(true)}
          onError={() => setReady(true)}
        />
      ) : null}
    </div>
  );
}

/** Decorative isometric staircase (same motif as the app icon). */
export function Cubes({ className, style }: { className?: string; style?: CSSProperties }) {
  const cube = (x: number, y: number, a: number, key: string) => {
    const dx = a * 0.866,
      dy = a * 0.5;
    const pts = (p: number[][]) => p.map((q) => q.join(",")).join(" ");
    const top = [
      [x, y],
      [x + dx, y + dy],
      [x, y + a],
      [x - dx, y + dy],
    ];
    const left = [
      [x - dx, y + dy],
      [x, y + a],
      [x, y + 2 * a],
      [x - dx, y + dy + a],
    ];
    const right = [
      [x, y + a],
      [x + dx, y + dy],
      [x + dx, y + dy + a],
      [x, y + 2 * a],
    ];
    return (
      <g key={key} stroke="#7a3218" strokeWidth={a * 0.05} strokeLinejoin="round">
        <polygon points={pts(left)} fill="#f3cfb5" />
        <polygon points={pts(right)} fill="#e7a983" />
        <polygon points={pts(top)} fill="#fff5ea" />
      </g>
    );
  };
  const a = 22,
    dx = a * 0.866,
    dy = a * 0.5;
  const parts = [];
  const cols = [1, 2, 3];
  for (let c = cols.length - 1; c >= 0; c--)
    for (let h = 0; h < cols[c]!; h++)
      parts.push(cube(60 + (c - 1) * dx, 60 - (c - 1) * dy - h * a, a, `${c}-${h}`));
  return (
    <svg className={className} style={style} viewBox="0 0 120 120" aria-hidden="true">
      {parts}
    </svg>
  );
}

export function Ring({ pct, label }: { pct: number; label?: string }) {
  return (
    <div className="ring" style={{ "--p": pct } as CSSProperties} aria-label={label} title={label}>
      <span>{pct}%</span>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bcard card" aria-hidden="true">
      <div className="skeleton" style={{ aspectRatio: "16/10", borderRadius: 0 }} />
      <div className="body">
        <div className="skeleton" style={{ height: 16, width: "70%" }} />
        <div className="skeleton" style={{ height: 11, width: "50%", marginTop: 6 }} />
      </div>
    </div>
  );
}

/** Light haptic feedback where supported (Android); silently ignored elsewhere. */
export function haptic(pattern: number | number[] = 12): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
