/** Inline SVG icons (drawn for this project). */
const PATHS: Record<string, string> = {
  back: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16l-4.3-4.3",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  import: "M12 3v12m0 0l-5-5m5 5l5-5M4 17v3h16v-3",
  download: "M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14",
  settings:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm8.4 3a8.4 8.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a8 8 0 0 0-2.2-1.3L15.3 2h-4l-.4 2.6a8 8 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a8.4 8.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 2.2 1.3l.4 2.6h4l.4-2.6a8 8 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 8v6m0-9.5v.5",
  cube: "M12 2l9 5v10l-9 5-9-5V7zm0 0v10m9-5l-9 5-9-5",
  layers: "M12 3l9 5-9 5-9-5zm-9 9l9 5 9-5M3 16l9 5 9-5",
  play: "M7 4l13 8-13 8z",
  stop: "M6 6h12v12H6z",
  check: "M5 12.5l4.5 4.5L19 7",
  rotl: "M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5",
  rotr: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zm8 3a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  sun: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5v2m0 16v2m10-10h-2M4 12H2m17.1-7.1l-1.4 1.4M6.3 17.7l-1.4 1.4m14.2 0l-1.4-1.4M6.3 6.3L4.9 4.9",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  close: "M6 6l12 12M18 6L6 18",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-2.5 7a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6m0 3v.5",
  trash: "M5 7h14M10 7V4h4v3m-7 0l1 13h8l1-13",
  reset: "M4 4v6h6M20 20v-6h-6M5 15a7 7 0 0 0 12.5 2.5M19 9A7 7 0 0 0 6.5 6.5",
  plan: "M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16",
  copy: "M8 8h11v12H8zM5 16V4h11",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4.5V12l3 2",
  ruler: "M3 15L15 3l6 6L9 21zm4-4l2 2m1-5l2 2m1-5l2 2",
};

export function Icon({
  name,
  size = 20,
  filled = false,
  title,
}: {
  name: keyof typeof PATHS | string;
  size?: number;
  filled?: boolean;
  title?: string;
}) {
  const d = PATHS[name] ?? PATHS.info!;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 1.2 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d={d} />
    </svg>
  );
}
