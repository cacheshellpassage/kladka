/** Small visual building blocks: fading cover images, decorative cubes, progress ring, skeletons. */
import { useMemo, useState, type CSSProperties } from "react";
import { blockIconUrl } from "@kladka/viewer";
import { useUi } from "../store/ui";

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
      <g key={key} stroke="#1e3a8a" strokeWidth={a * 0.05} strokeLinejoin="round">
        <polygon points={pts(left)} fill="#dbe7ff" />
        <polygon points={pts(right)} fill="#a9c4fb" />
        <polygon points={pts(top)} fill="#ffffff" />
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

/** Isometric inventory-style icon of a block (procedural or resource-pack textures). */
export function BlockIcon({ block, color, size = 22 }: { block: string; color?: number; size?: number }) {
  const provider = useUi((s) => s.provider);
  const url = useMemo(() => blockIconUrl(block, size, provider), [block, size, provider]);
  if (!url)
    return (
      <span
        className="sw"
        style={{ background: `#${(color ?? 0x999999).toString(16).padStart(6, "0")}` }}
        aria-hidden
      />
    );
  return (
    <img className="block-icon" src={url} width={size} height={size} alt="" aria-hidden draggable={false} />
  );
}
