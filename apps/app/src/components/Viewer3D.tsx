/** React wrapper around the three.js VoxelViewer. */
import { useEffect, useRef, useState } from "react";
import { VoxelViewer, type ClipBox, type RenderMode, type TimeOfDay, type Quality } from "@kladka/viewer";
import type { VoxelModel } from "@kladka/voxel-core";
import { useT } from "../i18n";
import { effectiveTheme, useSettings } from "../store/settings";
import { useUi } from "../store/ui";
import { Icon } from "./Icon";

export interface Viewer3DProps {
  model: VoxelModel;
  stepOf: Int32Array | null;
  roles: Uint8Array | null;
  step?: number | null;
  showFuture?: boolean;
  ghostBelowY?: number | null;
  selectedPalette?: number | null;
  clip?: ClipBox | null;
  roleView?: boolean;
  mode?: RenderMode;
  timeOfDay?: TimeOfDay;
  quality?: Quality;
  onReady?: (v: VoxelViewer) => void;
  onPick?: (p: { x: number; y: number; z: number; palette: number } | null) => void;
  tip?: string | null;
  controls?: boolean;
  label?: string;
}

function webgl2Available(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

export function Viewer3D(p: Viewer3DProps) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<VoxelViewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(0);
  const theme = useSettings((s) => effectiveTheme(s.theme));
  const settingsQuality = useSettings((s) => s.quality);
  const settingsMode = useSettings((s) => s.renderMode);
  const cameraButtons = useSettings((s) => s.cameraButtons);
  const provider = useUi((s) => s.provider);
  const quality = p.quality ?? settingsQuality;
  const mode = p.mode ?? settingsMode;

  // create / dispose
  useEffect(() => {
    if (!host.current) return;
    if (!webgl2Available()) {
      setError(t("viewer.webglError"));
      return;
    }
    let v: VoxelViewer;
    try {
      v = new VoxelViewer(host.current, { mode, quality, theme, timeOfDay: p.timeOfDay ?? "day" });
    } catch {
      setError(t("viewer.webglError"));
      return;
    }
    v.onContextLost = () => setError(t("viewer.contextLost"));
    if (provider) v.setTextureProvider(provider);
    viewerRef.current = v;
    if (import.meta.env.DEV) (window as unknown as { __kladkaViewer?: VoxelViewer }).__kladkaViewer = v;
    p.onReady?.(v);
    return () => {
      v.dispose();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // model
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    setProgress(0);
    void v
      .setModel(p.model, p.stepOf ? { stepOf: p.stepOf, roles: p.roles ?? undefined } : null, (x) =>
        setProgress(x),
      )
      .then(() => setProgress(null));
  }, [p.model, p.stepOf, p.roles]);

  useEffect(() => viewerRef.current?.setStep(p.step ?? null), [p.step]);
  useEffect(() => viewerRef.current?.setShowFuture(!!p.showFuture), [p.showFuture]);
  useEffect(
    () =>
      viewerRef.current?.setGhostBelow(
        p.ghostBelowY !== null && p.ghostBelowY !== undefined,
        p.ghostBelowY ?? 0,
      ),
    [p.ghostBelowY],
  );
  useEffect(() => viewerRef.current?.setSelectedPalette(p.selectedPalette ?? null), [p.selectedPalette]);
  useEffect(() => viewerRef.current?.setClip(p.clip ?? null), [p.clip]);
  useEffect(() => viewerRef.current?.setRoleView(!!p.roleView), [p.roleView]);
  useEffect(() => viewerRef.current?.setMode(mode), [mode]);
  useEffect(() => viewerRef.current?.setQuality(quality), [quality]);
  useEffect(() => viewerRef.current?.setTheme(theme), [theme]);
  useEffect(() => {
    if (p.timeOfDay) viewerRef.current?.setTimeOfDay(p.timeOfDay);
  }, [p.timeOfDay]);
  useEffect(() => viewerRef.current?.setTextureProvider(provider), [provider]);

  // tap to pick
  useEffect(() => {
    const el = host.current;
    if (!el || !p.onPick) return;
    let down: { x: number; y: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY, t: performance.now() });
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved < 6 && performance.now() - down.t < 400)
        p.onPick?.(viewerRef.current?.pick(e.clientX, e.clientY) ?? null);
      down = null;
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [p.onPick, p]);

  const v = () => viewerRef.current;
  return (
    <div className="viewer-host" ref={host} role="img" aria-label={p.label ?? "3D"}>
      {error ? <div className="viewer-msg">{error}</div> : null}
      {!error && progress !== null ? (
        <div className="viewer-msg" aria-live="polite">
          {t("viewer.loading", { p: Math.round(progress * 100) })}
        </div>
      ) : null}
      {p.tip ? <div className="viewer-tip">{p.tip}</div> : null}
      {!error && (p.controls ?? true) && cameraButtons ? (
        <div className="viewer-overlay">
          <button
            className="btn icon"
            type="button"
            title={t("viewer.zoomIn")}
            aria-label={t("viewer.zoomIn")}
            onClick={() => v()?.zoom(0.8)}
          >
            <Icon name="plus" />
          </button>
          <button
            className="btn icon"
            type="button"
            title={t("viewer.zoomOut")}
            aria-label={t("viewer.zoomOut")}
            onClick={() => v()?.zoom(1.25)}
          >
            <Icon name="minus" />
          </button>
          <button
            className="btn icon"
            type="button"
            title={t("viewer.rotateLeft")}
            aria-label={t("viewer.rotateLeft")}
            onClick={() => v()?.orbit(-Math.PI / 8)}
          >
            <Icon name="rotl" />
          </button>
          <button
            className="btn icon"
            type="button"
            title={t("viewer.rotateRight")}
            aria-label={t("viewer.rotateRight")}
            onClick={() => v()?.orbit(Math.PI / 8)}
          >
            <Icon name="rotr" />
          </button>
          <button
            className="btn icon"
            type="button"
            title={t("viewer.reset")}
            aria-label={t("viewer.reset")}
            onClick={() => v()?.resetCamera(0)}
          >
            <Icon name="reset" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
