import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { countItems, toLines, type MaterialLine } from "@kladka/voxel-core";
import type { VoxelViewer } from "@kladka/viewer";
import { useT, type MessageKey } from "../i18n";
import { canvasToJpeg, buildPdf, type PdfPage } from "../lib/pdf";
import { drawPlan, planColors } from "../lib/plan2d";
import { nameOf } from "../lib/format";
import { useBuild } from "../lib/useBuild";
import { safeFileName, saveFile } from "../platform/platform";
import { Link } from "../router";
import { useLibrary } from "../store/library";
import { useSettings } from "../store/settings";
import { useUi } from "../store/ui";
import { MaterialsTable, Segmented, Switch } from "../components/Common";
import { Icon } from "../components/Icon";
import { PlanCanvas } from "../components/PlanCanvas";
import { Viewer3D } from "../components/Viewer3D";

type Scope = "step" | "layer" | "stage" | "all";

export function GuidePage({ id }: { id: string }) {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const settings = useSettings();
  const { build, error, item } = useBuild(id);
  const saved = useLibrary((s) => s.progress.get(id));
  const saveProgress = useLibrary((s) => s.saveProgress);
  const showToast = useUi((s) => s.showToast);
  const [step, setStep] = useState<number>(saved?.step ?? 0);
  const [done, setDone] = useState<number>(saved?.done ?? 0);
  const [scope, setScope] = useState<Scope>("step");
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const viewer = useRef<VoxelViewer | null>(null);

  const total = build?.plan.steps.length ?? 0;
  const finished = total > 0 && step >= total;
  const cur = build && !finished ? build.plan.steps[Math.min(step, total - 1)] : undefined;
  const stage = build?.plan.stages.find((s) => step >= s.stepStart && step < s.stepEnd);

  // restore saved progress once the library is ready
  useEffect(() => {
    if (saved) {
      setStep(saved.step);
      setDone(saved.done);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id]);

  // persist
  useEffect(() => {
    if (!build) return;
    const h = setTimeout(() => saveProgress({ id, step, done, total }), 250);
    return () => clearTimeout(h);
  }, [build, id, step, done, total, saveProgress]);

  const go = useCallback((n: number) => setStep(Math.max(0, Math.min(total, n))), [total]);
  const markDone = useCallback(() => {
    setDone((d) => Math.max(d, step + 1));
    go(step + 1);
  }, [step, go]);

  // bounding box of the current step and whether the work happens inside the building
  const stepBox = useMemo(() => {
    if (!build || !cur) return null;
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const i of cur.blocks) {
      const c = build.model.coords(i);
      min[0] = Math.min(min[0], c.x);
      min[1] = Math.min(min[1], c.y);
      min[2] = Math.min(min[2], c.z);
      max[0] = Math.max(max[0], c.x + 1);
      max[1] = Math.max(max[1], c.y + 1);
      max[2] = Math.max(max[2], c.z + 1);
    }
    if (!Number.isFinite(min[0])) return null;
    const { x: sx, z: sz } = build.model.size;
    const cx = (min[0] + max[0]) / 2,
      cz = (min[2] + max[2]) / 2;
    const inset = 1.6;
    const centred = cx > inset && cx < sx - inset && cz > inset && cz < sz - inset;
    const inside =
      cur.stage === "interior" ||
      (centred &&
        cur.stage !== "roof" &&
        cur.stage !== "foundation" &&
        max[0] - min[0] < sx - 2 &&
        max[2] - min[2] < sz - 2);
    return { min, max, inside };
  }, [build, cur]);

  // cutaway: hide everything above the step when the work is indoors
  const cutaway = useMemo(() => {
    if (!settings.autoCutaway || !build || !stepBox?.inside) return null;
    const top = stepBox.max[1];
    if (top >= build.model.size.y) return null;
    return {
      min: [0, 0, 0] as [number, number, number],
      max: [build.model.size.x, top, build.model.size.z] as [number, number, number],
    };
  }, [settings.autoCutaway, build, stepBox]);

  // automatic camera: fly to the blocks of the current step
  useEffect(() => {
    const v = viewer.current;
    if (!settings.autoCamera || !stepBox || !cur || !v) return;
    const lookDown = stepBox.inside || cur.stage === "foundation";
    v.focusOn(stepBox.min, stepBox.max, {
      interior: lookDown ? true : undefined,
      closeness: stepBox.inside ? 0.7 : 1,
    });
  }, [cur, stepBox, settings.autoCamera]);

  // keyboard
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, select, textarea")) return;
      const v = viewer.current;
      switch (e.key) {
        case "ArrowRight":
          go(step + 1);
          break;
        case "ArrowLeft":
          go(step - 1);
          break;
        case " ":
        case "Enter":
          if ((e.target as HTMLElement)?.tagName === "BUTTON") return;
          e.preventDefault();
          markDone();
          break;
        case "a":
        case "A":
          v?.orbit(-Math.PI / 12);
          break;
        case "d":
        case "D":
          v?.orbit(Math.PI / 12);
          break;
        case "w":
        case "W":
          v?.orbit(0, Math.PI / 24);
          break;
        case "s":
        case "S":
          v?.orbit(0, -Math.PI / 24);
          break;
        case "+":
        case "=":
          v?.zoom(0.85);
          break;
        case "-":
          v?.zoom(1.18);
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [step, go, markDone]);

  const materials: MaterialLine[] = useMemo(() => {
    if (!build) return [];
    const plan = build.plan;
    let blocks: Iterable<number>;
    if (scope === "all") return build.materials;
    if (!cur) return [];
    if (scope === "step") blocks = cur.blocks;
    else {
      const st = stage!;
      const range: number[] = [];
      for (let i = st.stepStart; i < st.stepEnd; i++) {
        const s = plan.steps[i]!;
        if (scope === "stage" || s.layer === cur.layer) range.push(...s.blocks);
      }
      blocks = range;
    }
    return toLines(build.model, countItems(build.model, blocks));
  }, [build, cur, stage, scope]);

  const exportPng = async () => {
    if (!build || !cur) return;
    setBusy(true);
    try {
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d")!;
      const cell = Math.max(
        14,
        Math.min(32, Math.floor(1600 / Math.max(build.model.size.x, build.model.size.z))),
      );
      const title = `${item!.meta.title[locale]} — ${t("guide.layer", { y: cur.layer })}`;
      const size = drawPlan(document.createElement("canvas").getContext("2d")!, {
        model: build.model,
        stepOf: build.plan.stepOf,
        y: cur.layer,
        currentStep: step,
        cell,
        colors: planColors(false),
        nameOf: nameOf(locale),
        title,
      });
      c.width = size.width;
      c.height = size.height;
      drawPlan(ctx, {
        model: build.model,
        stepOf: build.plan.stepOf,
        y: cur.layer,
        currentStep: step,
        cell,
        colors: planColors(false),
        nameOf: nameOf(locale),
        title,
      });
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
      await saveFile(
        `${safeFileName(item!.meta.title.en)}-y${cur.layer}.png`,
        new Uint8Array(await blob.arrayBuffer()),
        "image/png",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "cancelled") showToast(t("export.failed", { msg }));
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    if (!build) return;
    setBusy(true);
    showToast(t("guide.exporting"));
    try {
      const pages: PdfPage[] = [];
      const cell = Math.max(
        10,
        Math.min(28, Math.floor(1100 / Math.max(build.model.size.x, build.model.size.z))),
      );
      for (let y = 0; y < build.model.size.y; y++) {
        let any = false;
        for (let z = 0; z < build.model.size.z && !any; z++)
          for (let x = 0; x < build.model.size.x; x++)
            if (build.model.blocks[build.model.index(x, y, z)]) {
              any = true;
              break;
            }
        if (!any) continue;
        const c = document.createElement("canvas");
        const title = `${item!.meta.title[locale]} — ${t("guide.layer", { y })}`;
        const probe = drawPlan(document.createElement("canvas").getContext("2d")!, {
          model: build.model,
          stepOf: null,
          y,
          currentStep: null,
          cell,
          colors: planColors(false),
          nameOf: nameOf(locale),
          title,
        });
        c.width = probe.width;
        c.height = probe.height;
        drawPlan(c.getContext("2d")!, {
          model: build.model,
          stepOf: null,
          y,
          currentStep: null,
          cell,
          colors: planColors(false),
          nameOf: nameOf(locale),
          title,
        });
        pages.push({ jpeg: await canvasToJpeg(c, 0.9), width: c.width, height: c.height });
      }
      await saveFile(`${safeFileName(item!.meta.title.en)}-layers.pdf`, buildPdf(pages), "application/pdf");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "cancelled") showToast(t("export.failed", { msg }));
    } finally {
      setBusy(false);
    }
  };

  if (!item)
    return (
      <p className="muted" style={{ padding: 16 }}>
        {t("build.notFound")}
      </p>
    );
  if (error)
    return (
      <div className="banner error" style={{ margin: 16 }}>
        {error}
      </div>
    );
  if (!build)
    return (
      <p className="muted" style={{ padding: 16 }}>
        {t("build.loading")}
      </p>
    );

  const pct = total ? Math.round((Math.min(done, total) / total) * 100) : 0;
  const view = settings.guideView;
  const showStep = finished ? null : step;
  const layerY = cur?.layer ?? 0;

  return (
    <div className="guide" data-testid="guide">
      <div className={`guide-stage ${view === "split" ? "split" : ""}`}>
        {view !== "2d" ? (
          <Viewer3D
            model={build.model}
            stepOf={build.plan.stepOf}
            roles={build.plan.roles}
            step={showStep}
            showFuture={settings.showFuture}
            ghostBelowY={settings.ghostBelow && cur ? layerY : null}
            selectedPalette={selected}
            clip={cutaway}
            tip={cutaway ? t("guide.cutaway", { y: cutaway.max[1] - 1 }) : null}
            onReady={(v) => (viewer.current = v)}
            label={item.meta.title[locale]}
          />
        ) : null}
        {view !== "3d" && cur ? (
          <PlanCanvas
            model={build.model}
            stepOf={build.plan.stepOf}
            y={layerY}
            currentStep={step}
            label={t("guide.layer", { y: layerY })}
          />
        ) : null}
      </div>

      <aside className="guide-side" aria-label={t("guide.title")}>
        <div className="scroll">
          <div className="row">
            <Link className="btn ghost icon" to={{ name: "build", id }} aria-label={t("nav.back")}>
              <Icon name="back" />
            </Link>
            <strong style={{ fontSize: "var(--fs-md)" }}>{item.meta.title[locale]}</strong>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <div className="row">
              {stage ? <span className="stage-pill">{t(`stage.${stage.id}` as MessageKey)}</span> : null}
              <span className="small" data-testid="step-label">
                {finished ? t("guide.finished") : t("guide.step", { n: step + 1, total })}
              </span>
              {cur ? <span className="small muted">{t("guide.layer", { y: cur.layer })}</span> : null}
            </div>
            <div
              className="progressbar"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="stage-list" aria-label={t("guide.stageJump")}>
            {build.plan.stages.map((s) => (
              <button
                key={s.id}
                type="button"
                className={step >= s.stepStart && step < s.stepEnd ? "cur" : done >= s.stepEnd ? "done" : ""}
                onClick={() => go(s.stepStart)}
              >
                {done >= s.stepEnd ? "✓ " : ""}
                {t(`stage.${s.id}` as MessageKey)}
              </button>
            ))}
          </div>

          {finished ? (
            <div className="stack">
              <p>{t("guide.finished")}</p>
              <button className="btn" type="button" onClick={() => (setStep(0), setDone(0))}>
                <Icon name="reset" /> {t("guide.restart")}
              </button>
            </div>
          ) : null}

          {cur?.deferred ? <div className="banner small">{t("guide.deferred")}</div> : null}
          {cur?.scaffold ? <div className="banner warn small">{t("guide.scaffold")}</div> : null}
          {cur ? (
            <div className="small muted">{t("guide.blocksInStep", { n: cur.blocks.length })}</div>
          ) : null}

          <Segmented<"3d" | "2d" | "split">
            label="view"
            value={view}
            onChange={(v) => settings.set({ guideView: v })}
            options={[
              { value: "3d", label: t("guide.view.3d") },
              { value: "split", label: t("guide.view.split") },
              { value: "2d", label: t("guide.view.2d") },
            ]}
          />

          <div className="stack" style={{ gap: 8 }}>
            <Segmented<Scope>
              label={t("build.materials")}
              value={scope}
              onChange={setScope}
              options={[
                { value: "step", label: t("materials.scope.step") },
                { value: "layer", label: t("materials.scope.layer") },
                { value: "stage", label: t("materials.scope.stage") },
                { value: "all", label: t("materials.scope.all") },
              ]}
            />
            <MaterialsTable
              lines={materials}
              model={build.model}
              selected={selected}
              onSelect={setSelected}
            />
          </div>

          <div className="stack" style={{ gap: 0 }}>
            <Switch
              label={t("guide.showFuture")}
              checked={settings.showFuture}
              onChange={(v) => settings.set({ showFuture: v })}
            />
            <Switch
              label={t("guide.autoCamera")}
              checked={settings.autoCamera}
              onChange={(v) => settings.set({ autoCamera: v })}
            />
            <Switch
              label={t("guide.autoCutaway")}
              checked={settings.autoCutaway}
              onChange={(v) => settings.set({ autoCutaway: v })}
            />
            <Switch
              label={t("guide.ghostBelow")}
              checked={settings.ghostBelow}
              onChange={(v) => settings.set({ ghostBelow: v })}
            />
          </div>

          <div className="row">
            <button className="btn" type="button" onClick={exportPng} disabled={busy || !cur}>
              <Icon name="plan" /> {t("guide.exportPng")}
            </button>
            <button className="btn" type="button" onClick={exportPdf} disabled={busy}>
              <Icon name="download" /> {t("guide.exportPdf")}
            </button>
          </div>
          <p className="small muted">{t("guide.keys")}</p>
        </div>

        <div className="guide-controls">
          <button
            className="btn big"
            type="button"
            onClick={() => go(step - 1)}
            disabled={step <= 0}
            aria-label={t("guide.prev")}
            data-testid="prev"
          >
            <Icon name="back" />
          </button>
          <button
            className="btn primary big"
            type="button"
            onClick={markDone}
            disabled={finished}
            data-testid="done"
          >
            <Icon name="check" /> {t("guide.done")}
          </button>
          <button
            className="btn big"
            type="button"
            onClick={() => go(step + 1)}
            disabled={finished}
            aria-label={t("guide.next")}
            data-testid="next"
          >
            <Icon name="next" />
          </button>
        </div>
      </aside>
    </div>
  );
}
