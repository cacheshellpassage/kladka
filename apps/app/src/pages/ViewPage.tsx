import { useEffect, useMemo, useRef, useState } from "react";
import { itemName } from "@kladka/voxel-core";
import { ROLE_COLORS_3D, type ClipBox, type TimeOfDay, type VoxelViewer } from "@kladka/viewer";
import { useT, type MessageKey } from "../i18n";
import { buildGif, recordVideo, videoSupported } from "../lib/media";
import { useBuild } from "../lib/useBuild";
import { safeFileName, saveBlob, saveDataUrl, saveFile } from "../platform/platform";
import { Link } from "../router";
import { useSettings, type ModePref, type QualityPref } from "../store/settings";
import { useUi } from "../store/ui";
import { MaterialsTable, Segmented, Switch } from "../components/Common";
import { Icon } from "../components/Icon";
import { Viewer3D } from "../components/Viewer3D";

type Axis = "none" | "x" | "y" | "z";

export function ViewPage({ id }: { id: string }) {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const settings = useSettings();
  const showToast = useUi((s) => s.showToast);
  const { build, error, item } = useBuild(id);
  const viewer = useRef<VoxelViewer | null>(null);
  const [mode, setMode] = useState<ModePref>(settings.renderMode);
  const [time, setTime] = useState<TimeOfDay>("day");
  const [quality, setQuality] = useState<QualityPref>(settings.quality);
  const [axis, setAxis] = useState<Axis>("none");
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [maxY, setMaxY] = useState<number>(Infinity);
  const [roleView, setRoleView] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [clip, setClip] = useState<ClipBox | null>(null);

  const size = build?.model.size;
  const axisLen = size ? (axis === "x" ? size.x : axis === "y" ? size.y : axis === "z" ? size.z : 0) : 0;

  useEffect(() => {
    if (size) setMaxY(size.y - 1);
  }, [size]);
  useEffect(() => setRange([0, Math.max(0, axisLen - 1)]), [axis, axisLen]);

  // debounce clip changes (they rebuild affected chunks)
  const wanted = useMemo<ClipBox | null>(() => {
    if (!size) return null;
    const min: [number, number, number] = [0, 0, 0];
    const max: [number, number, number] = [size.x, size.y, size.z];
    let active = false;
    if (axis !== "none") {
      const k = axis === "x" ? 0 : axis === "y" ? 1 : 2;
      min[k] = range[0];
      max[k] = range[1] + 1;
      active = true;
    }
    if (Number.isFinite(maxY) && maxY < size.y - 1) {
      max[1] = Math.min(max[1], maxY + 1);
      active = true;
    }
    return active ? { min, max } : null;
  }, [size, axis, range, maxY]);
  useEffect(() => {
    const h = setTimeout(() => setClip(wanted), 120);
    return () => clearTimeout(h);
  }, [wanted]);

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

  const total = build.plan.steps.length;
  const fileBase = safeFileName(item.meta.title.en);

  const animate = () => {
    const v = viewer.current;
    if (!v) return;
    if (animating) {
      v.stopAnimation();
      v.setStep(null);
      setAnimating(false);
      return;
    }
    setAnimating(true);
    v.animateBuild(total, Math.min(20000, Math.max(4000, total * 60)), () => setAnimating(false));
  };

  const screenshot = async () => {
    const v = viewer.current;
    if (!v) return;
    try {
      await saveDataUrl(`${fileBase}.png`, v.capture(1600, 1000, "image/png"));
    } catch (e) {
      if ((e as Error).message !== "cancelled") showToast(t("export.failed", { msg: (e as Error).message }));
    }
  };

  const gif = async () => {
    const v = viewer.current;
    if (!v) return;
    setBusy("gif");
    try {
      const bytes = await buildGif(v, total, { onProgress: (p) => setBusy(`gif ${Math.round(p * 100)}%`) });
      await saveFile(`${fileBase}.gif`, bytes, "image/gif");
    } catch (e) {
      if ((e as Error).message !== "cancelled") showToast(t("export.failed", { msg: (e as Error).message }));
    } finally {
      setBusy(null);
    }
  };

  const video = async () => {
    const v = viewer.current;
    if (!v) return;
    setBusy("video");
    try {
      const blob = await recordVideo(v, total, Math.min(15000, Math.max(5000, total * 50)));
      await saveBlob(`${fileBase}.webm`, blob);
    } catch (e) {
      if ((e as Error).message !== "cancelled") showToast(t("export.failed", { msg: (e as Error).message }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="view-page" data-testid="view-page">
      <Viewer3D
        model={build.model}
        stepOf={build.plan.stepOf}
        roles={build.plan.roles}
        step={null}
        clip={clip}
        roleView={roleView}
        selectedPalette={selected}
        mode={mode}
        quality={quality}
        timeOfDay={time}
        onReady={(v) => (viewer.current = v)}
        onPick={(p) => {
          if (!p) return setPicked(null);
          const st = build.model.palette[p.palette];
          setPicked(
            st ? t("viewer.picked", { name: itemName(st.name, locale), x: p.x, y: p.y, z: p.z }) : null,
          );
        }}
        tip={picked ?? t("viewer.pick")}
        label={item.meta.title[locale]}
      />
      <aside className="view-tools">
        <div className="row">
          <Link className="btn ghost icon" to={{ name: "build", id }} aria-label={t("nav.back")}>
            <Icon name="back" />
          </Link>
          <strong>{item.meta.title[locale]}</strong>
        </div>
        <fieldset>
          <legend>{t("viewer.mode")}</legend>
          <Segmented<ModePref>
            value={mode}
            onChange={setMode}
            options={[
              { value: "classic", label: t("settings.mode.classic") },
              { value: "shaders", label: t("settings.mode.shaders") },
            ]}
          />
          {mode === "shaders" ? (
            <>
              <Segmented<TimeOfDay>
                label={t("viewer.time")}
                value={time}
                onChange={setTime}
                options={[
                  { value: "day", label: t("viewer.time.day") },
                  { value: "sunset", label: t("viewer.time.sunset") },
                  { value: "night", label: t("viewer.time.night") },
                ]}
              />
              <Segmented<QualityPref>
                label={t("viewer.quality")}
                value={quality}
                onChange={setQuality}
                options={[
                  { value: "low", label: t("viewer.quality.low") },
                  { value: "medium", label: t("viewer.quality.medium") },
                  { value: "high", label: t("viewer.quality.high") },
                ]}
              />
            </>
          ) : null}
        </fieldset>

        <fieldset>
          <legend>{t("viewer.section")}</legend>
          <Segmented<Axis>
            label={t("viewer.section.axis")}
            value={axis}
            onChange={setAxis}
            options={[
              { value: "none", label: t("viewer.section.off") },
              { value: "x", label: "X" },
              { value: "y", label: "Y" },
              { value: "z", label: "Z" },
            ]}
          />
          {axis !== "none" ? (
            <>
              <label className="small">
                {t("viewer.section.from")}: {range[0]}
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, axisLen - 1)}
                  value={range[0]}
                  onChange={(e) => setRange([Math.min(Number(e.target.value), range[1]), range[1]])}
                />
              </label>
              <label className="small">
                {t("viewer.section.to")}: {range[1]}
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, axisLen - 1)}
                  value={range[1]}
                  onChange={(e) => setRange([range[0], Math.max(Number(e.target.value), range[0])])}
                />
              </label>
            </>
          ) : null}
          <label className="small">
            {t("viewer.layers")}: {Number.isFinite(maxY) ? maxY : build.model.size.y - 1}
            <input
              type="range"
              min={0}
              max={build.model.size.y - 1}
              value={Number.isFinite(maxY) ? maxY : build.model.size.y - 1}
              onChange={(e) => setMaxY(Number(e.target.value))}
              data-testid="layers-slider"
            />
          </label>
          <Switch label={t("viewer.roles")} checked={roleView} onChange={setRoleView} />
          {roleView ? (
            <ul className="role-legend">
              {Object.entries(ROLE_COLORS_3D).map(([id, c]) => (
                <li key={id}>
                  <i className="stage-dot" style={{ background: c }} aria-hidden />
                  {t(`stage.${id}` as MessageKey)}
                </li>
              ))}
            </ul>
          ) : null}
        </fieldset>

        <fieldset>
          <legend>{t("viewer.animate")}</legend>
          <div className="row">
            <button className="btn" type="button" onClick={animate}>
              <Icon name={animating ? "stop" : "play"} /> {animating ? t("viewer.stop") : t("viewer.animate")}
            </button>
            <button className="btn" type="button" onClick={screenshot}>
              <Icon name="camera" /> {t("viewer.screenshot")}
            </button>
            <button className="btn" type="button" onClick={gif} disabled={!!busy}>
              <Icon name="download" /> {busy?.startsWith("gif") ? busy : t("viewer.gif")}
            </button>
            {videoSupported() ? (
              <button className="btn" type="button" onClick={video} disabled={!!busy}>
                <Icon name="download" /> {busy === "video" ? "…" : t("viewer.video")}
              </button>
            ) : null}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t("build.materials")}</legend>
          <MaterialsTable
            lines={build.materials}
            model={build.model}
            selected={selected}
            onSelect={setSelected}
          />
        </fieldset>
      </aside>
    </div>
  );
}
