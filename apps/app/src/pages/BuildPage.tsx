import { useEffect, useState } from "react";
import { useT, type MessageKey } from "../i18n";
import { previewUrl } from "../lib/content";
import { formatMinutes } from "../lib/format";
import { ensureImportCovers } from "../lib/importer";
import { forgetBuild, useBuild } from "../lib/useBuild";
import { Link, navigate } from "../router";
import { useLibrary } from "../store/library";
import { useSettings, type ModePref } from "../store/settings";
import {
  BuildNotFound,
  DifficultyDots,
  MaterialsTable,
  Segmented,
  Disclaimer,
  StageDot,
} from "../components/Common";
import { ExportDialog } from "../components/ExportDialog";
import { Icon } from "../components/Icon";
import { Passport } from "../components/Passport";

export function BuildPage({ id }: { id: string }) {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const coverStyle = useSettings((s) => s.coverStyle);
  const setSettings = useSettings((s) => s.set);
  const { build, error, item } = useBuild(id);
  const status = useLibrary((s) => s.status);
  const favorites = useLibrary((s) => s.favorites);
  const toggleFavorite = useLibrary((s) => s.toggleFavorite);
  const progress = useLibrary((s) => s.progress.get(id));
  const removeImport = useLibrary((s) => s.removeImport);
  const [angle, setAngle] = useState(0);
  const [exporting, setExporting] = useState(false);
  const reloadImports = useLibrary((s) => s.reloadImports);
  const needsCovers = item?.source === "import" && !item.covers;

  // builds imported by older versions: render the classic + shaders covers once, on this device
  useEffect(() => {
    if (!needsCovers) return;
    void ensureImportCovers(id).then((updated) => {
      if (updated) void reloadImports();
    });
  }, [id, needsCovers, reloadImports]);

  if (!item) return status === "ready" ? <BuildNotFound /> : <p className="muted">{t("common.loading")}</p>;
  const fav = favorites.has(id);
  const cover = previewUrl(item, coverStyle, "cover", angle);
  const angleCount =
    item.source === "core"
      ? ((coverStyle === "shaders" ? item.previews?.cinematic : item.previews?.classic)?.length ?? 0)
      : 0;
  const angles = Array.from({ length: angleCount }, (_, i) => i);
  const stagesPresent = build?.plan.stages ?? [];

  const del = async () => {
    if (!confirm(t("build.delete.confirm", { name: item.meta.title[locale] }))) return;
    forgetBuild(id);
    await removeImport(id);
    navigate({ name: "catalog" }, true);
  };

  return (
    <div className="stack">
      <div className="row">
        <Link className="btn ghost" to={{ name: "catalog" }}>
          <Icon name="back" /> {t("nav.catalog")}
        </Link>
      </div>
      <div className="build-layout">
        <div className="stack">
          <div className="hero card">
            {cover ? (
              <img key={cover} className="fade-in" src={cover} alt={item.meta.title[locale]} />
            ) : (
              <div className="viewer-msg" style={{ position: "static", aspectRatio: "16/10" }}>
                {t("build.noPreview")}
              </div>
            )}
            <div className="row" style={{ padding: "10px 10px 0" }}>
              <Segmented<ModePref>
                label={t("viewer.mode")}
                value={coverStyle}
                onChange={(v) => setSettings({ coverStyle: v })}
                options={[
                  { value: "classic", label: t("build.cover.classic") },
                  { value: "shaders", label: t("build.cover.shaders") },
                ]}
              />
            </div>
            {angles.length ? (
              <div className="thumbs">
                {angles.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={a === angle}
                    onClick={() => setAngle(a)}
                    aria-label={`${a + 1}`}
                  >
                    <img src={previewUrl(item, coverStyle, "cover", a)} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="stack">
          <div className="card panel stack">
            <div className="row">
              <h1 style={{ margin: 0 }}>{item.meta.title[locale]}</h1>
              <span className="spacer" />
              <button
                className="btn icon ghost"
                type="button"
                onClick={() => toggleFavorite(id)}
                aria-pressed={fav}
                aria-label={fav ? t("build.favorite.remove") : t("build.favorite.add")}
                title={fav ? t("build.favorite.remove") : t("build.favorite.add")}
              >
                <Icon name="star" filled={fav} />
              </button>
            </div>
            {item.meta.description ? <p style={{ margin: 0 }}>{item.meta.description[locale]}</p> : null}
            <div className="stats">
              <div className="stat">
                <b>{item.stats.size.join("×")}</b>
                <span>{t("build.size")}</span>
              </div>
              <div className="stat">
                <b>{item.stats.blocks}</b>
                <span>{t("build.blocks")}</span>
              </div>
              <div className="stat">
                <b>{formatMinutes(t, item.stats.minutes)}</b>
                <span>{t("build.time")}</span>
              </div>
              <div className="stat">
                <b>
                  <DifficultyDots value={item.stats.difficulty} />
                </b>
                <span>{t(`difficulty.${item.stats.difficulty}` as MessageKey)}</span>
              </div>
              <div className="stat">
                <b>{item.stats.steps}</b>
                <span>{t("build.steps")}</span>
              </div>
            </div>
            <div className="row build-cta">
              <Link className="btn primary big" to={{ name: "guide", id }} data-testid="start-guide">
                <Icon name="layers" />
                {progress && progress.step > 0
                  ? t("build.continue", { n: progress.step + 1 })
                  : t("build.start")}
              </Link>
              <Link className="btn big" to={{ name: "view", id }}>
                <Icon name="cube" /> {t("build.view3d")}
              </Link>
              <button
                className="btn big"
                type="button"
                disabled={!build}
                onClick={() => setExporting(true)}
                data-testid="export"
              >
                <Icon name="download" /> {t("build.export")}
              </button>
            </div>
            {stagesPresent.length ? (
              <div className="stack" style={{ gap: 6 }}>
                <span className="small muted">{t("build.stages")}</span>
                <div className="stage-list">
                  {stagesPresent.map((s) => (
                    <span key={s.id} className="chip" style={{ cursor: "default" }}>
                      <StageDot id={s.id} />
                      {t(`stage.${s.id}` as MessageKey)} · {s.blockCount}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {build ? <Passport model={build.model} /> : null}
            {item.warnings?.length ? (
              <div className="banner warn small">
                <b>{t("build.warnings")}:</b> {item.warnings.join("; ")}
              </div>
            ) : null}
            <div className="small muted">
              {t("build.author")}: {item.meta.author} · {t("build.license")}: {item.meta.license} ·{" "}
              {item.meta.createdAt}
            </div>
            {item.source === "import" ? (
              <button className="btn danger" type="button" onClick={del} style={{ alignSelf: "flex-start" }}>
                <Icon name="trash" /> {t("build.delete")}
              </button>
            ) : null}
          </div>

          <div className="card panel">
            <h2>{t("build.materials")}</h2>
            {error ? <div className="banner error">{error}</div> : null}
            {build ? (
              <MaterialsTable
                lines={build.materials}
                model={build.model}
                checklistId={id}
                title={item.meta.title[locale]}
              />
            ) : (
              <p className="muted">{t("build.loading")}</p>
            )}
          </div>
        </div>
      </div>
      <Disclaimer />
      {exporting && build ? (
        <ExportDialog model={build.model} name={item.meta.title.en} onClose={() => setExporting(false)} />
      ) : null}
    </div>
  );
}
