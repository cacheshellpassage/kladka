/** Small visual building blocks: fading cover images, decorative cubes, progress ring, skeletons. */
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
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

/* ------------------------------------------------------------------ */
/* empty states                                                        */
/* ------------------------------------------------------------------ */

type EmptyKind = "search" | "favorites" | "import" | "notFound" | "error";

/** One isometric cube in the illustration style (colours come from CSS tokens). */
function IsoCube({ x, y, a, tone = 0 }: { x: number; y: number; a: number; tone?: 0 | 1 | 2 }) {
  const dx = a * 0.866,
    dy = a * 0.5;
  const p = (q: number[][]) => q.map((v) => v.join(",")).join(" ");
  return (
    <g className={`iso tone-${tone}`}>
      <polygon
        className="l"
        points={p([
          [x - dx, y + dy],
          [x, y + a],
          [x, y + 2 * a],
          [x - dx, y + dy + a],
        ])}
      />
      <polygon
        className="r"
        points={p([
          [x, y + a],
          [x + dx, y + dy],
          [x + dx, y + dy + a],
          [x, y + 2 * a],
        ])}
      />
      <polygon
        className="t"
        points={p([
          [x, y],
          [x + dx, y + dy],
          [x, y + a],
          [x - dx, y + dy],
        ])}
      />
    </g>
  );
}

function EmptyArt({ kind }: { kind: EmptyKind }) {
  return (
    <svg className="empty-art" width="132" height="104" viewBox="0 0 132 104" aria-hidden>
      <ellipse className="shadow" cx="66" cy="94" rx="44" ry="7" />
      {kind === "search" ? (
        <>
          <IsoCube x={52} y={40} a={22} />
          <IsoCube x={72} y={51} a={22} tone={1} />
          <circle className="accent-stroke" cx="94" cy="30" r="14" />
          <path className="accent-stroke" d="M104 40l12 12" />
        </>
      ) : kind === "favorites" ? (
        <>
          <IsoCube x={66} y={38} a={26} />
          <path
            className="accent-fill"
            d="M66 6l5.3 10.8 11.9 1.7-8.6 8.4 2 11.8L66 33.1l-10.6 5.6 2-11.8-8.6-8.4 11.9-1.7z"
          />
        </>
      ) : kind === "import" ? (
        <>
          <IsoCube x={52} y={52} a={20} tone={1} />
          <IsoCube x={80} y={52} a={20} tone={2} />
          <IsoCube x={66} y={22} a={20} />
          <path className="accent-stroke" d="M66 4v12m-6-6l6 6 6-6" />
        </>
      ) : kind === "notFound" ? (
        <>
          <IsoCube x={50} y={48} a={22} tone={1} />
          <g className="ghost">
            <IsoCube x={82} y={40} a={22} tone={2} />
          </g>
          <text className="accent-text" x="82" y="70" textAnchor="middle">
            ?
          </text>
        </>
      ) : (
        <>
          <g transform="rotate(-14 56 60)">
            <IsoCube x={56} y={40} a={22} tone={1} />
          </g>
          <IsoCube x={88} y={58} a={14} tone={2} />
          <path className="warn-stroke" d="M30 22l8 8m0-8l-8 8" />
        </>
      )}
    </svg>
  );
}

/** Friendly empty/error state: a small illustration, a title, an optional hint and an action. */
export function EmptyState({
  kind,
  title,
  hint,
  children,
}: {
  kind: EmptyKind;
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty" role={kind === "error" ? "alert" : undefined}>
      <EmptyArt kind={kind} />
      <strong className="empty-title">{title}</strong>
      {hint ? <span className="small">{hint}</span> : null}
      {children}
    </div>
  );
}
