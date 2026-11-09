import { useMemo, useState, type CSSProperties } from "react";
import { useT, type MessageKey } from "../i18n";
import { previewUrl, type LibraryItem } from "../lib/content";
import { formatMinutes } from "../lib/format";
import { Link } from "../router";
import { useLibrary } from "../store/library";
import { useSettings } from "../store/settings";
import { Disclaimer, DifficultyDots } from "../components/Common";
import { Icon } from "../components/Icon";
import { CoverImg, Cubes, Ring, SkeletonCard } from "../components/Visual";

type SizeFilter = "all" | "small" | "medium" | "large";
type Sort = "name" | "blocks" | "difficulty";

function sizeOf(b: LibraryItem): Exclude<SizeFilter, "all"> {
  const n = b.stats.blocks;
  return n < 400 ? "small" : n < 900 ? "medium" : "large";
}

export function CatalogPage() {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const coverStyle = useSettings((s) => s.coverStyle);
  const { core, imports, favorites, progress, status, error } = useLibrary();
  const [q, setQ] = useState("");
  const [style, setStyle] = useState<string>("all");
  const [size, setSize] = useState<SizeFilter>("all");
  const [diff, setDiff] = useState<number>(0);
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("name");
  const [filtersOpen, setFiltersOpen] = useState(() => !matchMedia("(max-width: 720px)").matches);

  const all = useMemo(() => [...imports, ...core], [core, imports]);
  const styles = useMemo(() => [...new Set(all.map((b) => b.meta.style))], [all]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = all.filter((b) => {
      if (favOnly && !favorites.has(b.id)) return false;
      if (style !== "all" && b.meta.style !== style) return false;
      if (size !== "all" && sizeOf(b) !== size) return false;
      if (diff && b.stats.difficulty !== diff) return false;
      if (needle) {
        const hay = `${b.meta.title.ru} ${b.meta.title.en} ${b.meta.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      if (sort === "blocks") return a.stats.blocks - b.stats.blocks;
      if (sort === "difficulty")
        return a.stats.difficulty - b.stats.difficulty || a.stats.blocks - b.stats.blocks;
      return a.meta.title[locale].localeCompare(b.meta.title[locale], locale);
    });
    return out;
  }, [all, q, style, size, diff, favOnly, sort, favorites, locale]);

  const inProgress = useMemo(
    () =>
      all
        .map((b) => {
          const pr = progress.get(b.id);
          if (!pr || !pr.total || pr.step <= 0 || pr.done >= pr.total) return null;
          return { b, pct: Math.round((pr.done / pr.total) * 100), step: pr.step, at: pr.updatedAt };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => b.at - a.at)
        .slice(0, 6),
    [all, progress],
  );

  const activeFilters = (style !== "all" ? 1 : 0) + (size !== "all" ? 1 : 0) + (diff ? 1 : 0);

  const reset = () => {
    setQ("");
    setStyle("all");
    setSize("all");
    setDiff(0);
    setFavOnly(false);
  };

  return (
    <>
      <div className="catalog-head">
        <section className="hero-banner">
          <Cubes className="cubes" />
          <h1>{t("catalog.heroTitle")}</h1>
          <p>{t("catalog.heroLead", { n: all.length })}</p>
        </section>
        {inProgress.length ? (
          <section aria-label={t("catalog.continue")}>
            <div className="section-title">
              <Icon name="layers" size={18} /> {t("catalog.continue")}
            </div>
            <div className="continue-strip">
              {inProgress.map(({ b, pct, step }, i) => (
                <Link
                  key={b.id}
                  className="continue-card card"
                  style={{ animationDelay: `${i * 60}ms` }}
                  to={{ name: "guide", id: b.id }}
                >
                  <img src={previewUrl(b, coverStyle, "thumb")} alt="" />
                  <span>
                    <span className="t">{b.meta.title[locale]}</span>
                    <br />
                    <span className="s">
                      {t("catalog.continueStep", { n: step + 1, total: b.stats.steps })}
                    </span>
                  </span>
                  <Ring pct={pct} label={t("catalog.progress", { p: pct })} />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
        <div className="row">
          <span className="section-title" style={{ margin: 0 }}>
            <Icon name="grid" size={18} /> {t("catalog.title")}
          </span>
          <span className="muted small">{t("catalog.count", { n: list.length })}</span>
        </div>
        <div className="searchbox">
          <Icon name="search" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("catalog.search")}
            aria-label={t("catalog.search")}
          />
        </div>
        <div className="chips">
          <button className="chip" type="button" aria-pressed={favOnly} onClick={() => setFavOnly(!favOnly)}>
            <Icon name="star" size={16} filled={favOnly} /> {t("catalog.favorites")}
          </button>
          <button
            className="chip"
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="catalog-filters"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <Icon name="layers" size={16} /> {t("catalog.filters")}
            {activeFilters ? ` (${activeFilters})` : ""}
          </button>
        </div>
        <div id="catalog-filters" className="stack" hidden={!filtersOpen} style={{ gap: 12 }}>
          <div className="chips" role="group" aria-label={t("catalog.style")}>
            <button
              className="chip"
              type="button"
              aria-pressed={style === "all"}
              onClick={() => setStyle("all")}
            >
              {t("catalog.all")}
            </button>
            {styles.map((s) => (
              <button
                key={s}
                className="chip"
                type="button"
                aria-pressed={style === s}
                onClick={() => setStyle(style === s ? "all" : s)}
              >
                {t(`style.${s}` as MessageKey)}
              </button>
            ))}
          </div>
          <div className="filters">
            <label className="row small">
              {t("catalog.size")}
              <select value={size} onChange={(e) => setSize(e.target.value as SizeFilter)}>
                <option value="all">{t("catalog.all")}</option>
                <option value="small">{t("catalog.size.small")}</option>
                <option value="medium">{t("catalog.size.medium")}</option>
                <option value="large">{t("catalog.size.large")}</option>
              </select>
            </label>
            <label className="row small">
              {t("catalog.difficulty")}
              <select value={diff} onChange={(e) => setDiff(Number(e.target.value))}>
                <option value={0}>{t("catalog.all")}</option>
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>
                    {t(`difficulty.${d}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="row small">
              {t("catalog.sort")}
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="name">{t("catalog.sort.name")}</option>
                <option value="blocks">{t("catalog.sort.blocks")}</option>
                <option value="difficulty">{t("catalog.sort.difficulty")}</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {status === "loading" || status === "idle" ? (
        <div className="grid">
          {Array.from({ length: 8 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : null}
      {status === "error" ? <div className="banner error">{error}</div> : null}
      {status === "ready" && list.length === 0 ? (
        <div className="stack" style={{ alignItems: "flex-start" }}>
          <p className="muted">{t("catalog.empty")}</p>
          <button className="btn" type="button" onClick={reset}>
            {t("catalog.reset")}
          </button>
        </div>
      ) : null}

      <div className="grid" data-testid="catalog-grid">
        {list.map((b, idx) => {
          const pr = progress.get(b.id);
          const pct = pr && pr.total ? Math.round((pr.done / pr.total) * 100) : 0;
          const img = previewUrl(b, coverStyle, "thumb");
          return (
            <Link
              key={`${b.source}:${b.id}`}
              className="bcard card"
              style={{ "--i": idx } as CSSProperties}
              to={{ name: "build", id: b.id }}
              data-testid={`build-${b.id}`}
            >
              <CoverImg src={img} />
              {b.source === "import" ? <span className="badge">{t("style.imported")}</span> : null}
              {favorites.has(b.id) ? (
                <span className="fav">
                  <Icon name="star" filled size={22} />
                </span>
              ) : null}
              <div className="body">
                <span className="title">{b.meta.title[locale]}</span>
                <span className="meta">
                  <span>{t(`style.${b.meta.style}` as MessageKey)}</span>
                  <span>·</span>
                  <span>{b.stats.size.join("×")}</span>
                  <span>·</span>
                  <span>{formatMinutes(t, b.stats.minutes)}</span>
                </span>
                <span className="meta">
                  <DifficultyDots value={b.stats.difficulty} />
                  <span>{b.stats.blocks}</span>
                </span>
                {pct > 0 ? (
                  <div
                    className="progressbar"
                    aria-label={t("catalog.progress", { p: pct })}
                    title={t("catalog.progress", { p: pct })}
                  >
                    <div style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
      <footer className="footer">
        <Disclaimer />
      </footer>
    </>
  );
}
