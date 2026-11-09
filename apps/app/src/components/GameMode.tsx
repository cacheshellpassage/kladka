/**
 * "I'm in the game" mode: a calm full-screen layout for the phone lying next to the keyboard.
 * Big step number, the current layer plan, materials for the step, huge one-hand buttons placed
 * on the thumb side, swipe navigation, and the screen is kept awake (Screen Wake Lock API).
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { countItems, toLines, type VoxelModel } from "@kladka/voxel-core";
import { useT, type MessageKey } from "../i18n";
import { blocksWord, formatCount, nameOf } from "../lib/format";
import { useSettings } from "../store/settings";
import { Icon } from "./Icon";
import { PlanCanvas } from "./PlanCanvas";
import { Viewer3D } from "./Viewer3D";
import type { SerializedPlan } from "../lib/worker-client";

type WakeLockSentinelLike = { release: () => Promise<void>; released?: boolean };

/** Keeps the screen on while `active` (re-acquired when the page becomes visible again). */
export function useWakeLock(active: boolean): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!active) return;
    const wl = (
      navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } }
    ).wakeLock;
    if (!wl) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let alive = true;
    const acquire = async () => {
      try {
        sentinel = await wl.request("screen");
        if (alive) setOk(true);
      } catch {
        if (alive) setOk(false);
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible" && (!sentinel || sentinel.released)) void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release().catch(() => undefined);
      setOk(false);
    };
  }, [active]);
  return ok;
}

export interface GameModeProps {
  title: string;
  model: VoxelModel;
  plan: SerializedPlan;
  step: number;
  total: number;
  finished: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDone: () => void;
  onExit: () => void;
}

export function GameMode(p: GameModeProps) {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const units = useSettings((s) => s.units);
  const hand = useSettings((s) => s.hand);
  const [show3d, setShow3d] = useState(false);
  const awake = useWakeLock(true);
  const cur = p.finished ? undefined : p.plan.steps[Math.min(p.step, p.total - 1)];
  const stage = p.plan.stages.find((s) => p.step >= s.stepStart && p.step < s.stepEnd);
  const lines = useMemo(() => (cur ? toLines(p.model, countItems(p.model, cur.blocks)) : []), [cur, p.model]);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const onDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest(".viewer-host")) return; // let the 3D view rotate
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: ReactPointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x,
      dy = e.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 60) (dx < 0 ? p.onNext : p.onPrev)();
  };

  return (
    <div
      className={`game-mode ${hand === "left" ? "left" : ""}`}
      data-testid="game-mode"
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={() => (swipe.current = null)}
    >
      <header className="gm-top">
        <button className="btn icon ghost" type="button" onClick={p.onExit} aria-label={t("game.exit")}>
          <Icon name="close" />
        </button>
        <div className="gm-title">
          <strong>{p.title}</strong>
          <span>
            {stage ? t(`stage.${stage.id}` as MessageKey) : ""}
            {awake ? ` · ${t("game.awake")}` : ""}
          </span>
        </div>
        <button
          className="btn icon ghost"
          type="button"
          onClick={() => setShow3d(!show3d)}
          aria-label={show3d ? t("guide.view.2d") : t("guide.view.3d")}
        >
          <Icon name={show3d ? "plan" : "cube"} />
        </button>
      </header>

      <div className="gm-step" key={p.step}>
        {p.finished ? (
          <span className="gm-num">🏆</span>
        ) : (
          <>
            <span className="gm-num">{p.step + 1}</span>
            <span className="gm-of">
              / {p.total}
              <br />
              {cur ? t("guide.layer", { y: cur.layer }) : ""}
            </span>
          </>
        )}
      </div>

      <div className="gm-visual">
        {cur && show3d ? (
          <Viewer3D
            model={p.model}
            stepOf={p.plan.stepOf}
            roles={p.plan.roles}
            step={p.step}
            controls={false}
            label={p.title}
          />
        ) : cur ? (
          <PlanCanvas
            model={p.model}
            stepOf={p.plan.stepOf}
            y={cur.layer}
            currentStep={p.step}
            label={t("guide.layer", { y: cur.layer })}
          />
        ) : (
          <p className="gm-finished">{t("guide.finished")}</p>
        )}
      </div>

      {cur ? (
        <ul className="gm-mats" aria-label={t("build.materials")}>
          {lines.slice(0, 4).map((l) => (
            <li key={l.item}>
              <span>{nameOf(locale)(l.item)}</span>
              <b>{formatCount(t, l, units)}</b>
            </li>
          ))}
          {lines.length > 4 ? <li className="more">+{lines.length - 4}</li> : null}
          <li className="sum">
            {cur.blocks.length} {blocksWord(locale, cur.blocks.length)}
          </li>
        </ul>
      ) : null}

      <footer className="gm-controls">
        <div className="gm-nav">
          <button
            className="btn big"
            type="button"
            onClick={p.onPrev}
            disabled={p.step <= 0}
            aria-label={t("guide.prev")}
          >
            <Icon name="back" size={26} />
          </button>
          <button
            className="btn big"
            type="button"
            onClick={p.onNext}
            disabled={p.finished}
            aria-label={t("guide.next")}
          >
            <Icon name="next" size={26} />
          </button>
        </div>
        <button
          className="btn primary gm-done"
          type="button"
          onClick={p.onDone}
          disabled={p.finished}
          data-testid="game-done"
        >
          <Icon name="check" size={30} /> {t("guide.done")}
        </button>
      </footer>
    </div>
  );
}
