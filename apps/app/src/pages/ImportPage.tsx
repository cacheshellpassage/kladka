import { useRef, useState, type DragEvent } from "react";
import { useT } from "../i18n";
import { importFile } from "../lib/importer";
import { Link, navigate } from "../router";
import { useLibrary } from "../store/library";
import { useSettings } from "../store/settings";
import { Icon } from "../components/Icon";

export function ImportPage() {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const imports = useLibrary((s) => s.imports);
  const reloadImports = useLibrary((s) => s.reloadImports);
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ kind: "idle" | "working" | "done" | "error"; msg?: string }>({
    kind: "idle",
  });
  const [over, setOver] = useState(false);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setState({ kind: "working" });
    try {
      const recs = await importFile(file);
      await reloadImports();
      if (recs.length === 1) {
        setState({ kind: "done", msg: t("import.success") });
        navigate({ name: "build", id: recs[0]!.id });
      } else {
        setState({ kind: "done", msg: t("import.packAdded", { n: recs.length }) });
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setState({ kind: "error", msg: m === "too-big" ? t("import.tooBig") : t("import.error", { msg: m }) });
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void handle(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="stack prose" style={{ maxWidth: 820 }}>
      <h1>{t("import.title")}</h1>
      <p className="muted">{t("import.lead")}</p>
      <div
        className={`dropzone ${over ? "over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <Icon name="import" size={40} />
        <button
          className="btn primary big"
          type="button"
          onClick={() => input.current?.click()}
          disabled={state.kind === "working"}
        >
          {t("import.choose")}
        </button>
        <span className="small muted">{t("import.drop")}</span>
        <input
          ref={input}
          type="file"
          accept=".schem,.schematic,.litematic,.nbt,.kbuild,.zip"
          hidden
          data-testid="import-input"
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <p className="small muted">{t("import.packLead")}</p>
      {state.kind === "working" ? (
        <div className="banner" role="status">
          {t("import.working")}
        </div>
      ) : null}
      {state.kind === "done" ? (
        <div className="banner" role="status">
          {state.msg}
        </div>
      ) : null}
      {state.kind === "error" ? (
        <div className="banner error" role="alert">
          {state.msg}
        </div>
      ) : null}

      <h2>{t("import.recent")}</h2>
      {imports.length === 0 ? <p className="muted">{t("import.none")}</p> : null}
      <div className="grid">
        {imports.map((b) => (
          <Link key={b.id} className="bcard card" to={{ name: "build", id: b.id }}>
            {b.thumb ? <img className="cover" src={b.thumb} alt="" /> : <div className="cover" />}
            <div className="body">
              <span className="title">{b.meta.title[locale]}</span>
              <span className="meta">
                {b.stats.size.join("×")} · {b.stats.blocks}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
