import { useEffect, useRef, useState } from "react";
import { clearAll, estimateStorage, getOne, put, remove } from "../db/db";
import { useT } from "../i18n";
import { formatBytes } from "../lib/format";
import { createProvider, loadResourcePack } from "../lib/resourcepack";
import {
  useSettings,
  type Locale,
  type ModePref,
  type QualityPref,
  type ThemePref,
  type Units,
} from "../store/settings";
import { useUi } from "../store/ui";
import { Segmented, Switch } from "../components/Common";

export function SettingsPage() {
  const t = useT();
  const s = useSettings();
  const showToast = useUi((u) => u.showToast);
  const providerInfo = useUi((u) => u.providerInfo);
  const setProvider = useUi((u) => u.setProvider);
  const fileInput = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<number | null>(null);
  const [rpBusy, setRpBusy] = useState(false);

  useEffect(() => {
    void estimateStorage().then(setUsage);
  }, []);

  const loadPack = async (file: File | undefined) => {
    if (!file) return;
    setRpBusy(true);
    try {
      const pack = await loadResourcePack(file);
      const n = Object.keys(pack.textures).length;
      if (!n) {
        showToast(t("settings.resourcePack.error"));
        return;
      }
      setProvider(createProvider(pack), { name: pack.name, count: n });
      if (s.rememberResourcePack)
        await put("resourcePack", { id: "active", name: pack.name, textures: pack.textures });
    } catch (e) {
      showToast(t("import.error", { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setRpBusy(false);
    }
  };

  const toggleRemember = async (v: boolean) => {
    s.set({ rememberResourcePack: v });
    if (!v) await remove("resourcePack", "active");
  };

  const clear = async () => {
    if (!confirm(t("settings.clear.confirm"))) return;
    await clearAll();
    s.reset();
    setProvider(null, null);
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    showToast(t("settings.cleared"));
    setTimeout(() => location.reload(), 600);
  };

  return (
    <div className="stack prose" style={{ maxWidth: 720 }}>
      <h1>{t("settings.title")}</h1>

      <section className="card panel settings-group">
        <label>{t("settings.language")}</label>
        <Segmented<Locale>
          value={s.locale}
          onChange={(locale) => s.set({ locale })}
          options={[
            { value: "ru", label: "Русский" },
            { value: "en", label: "English" },
          ]}
        />
        <label>{t("settings.theme")}</label>
        <Segmented<ThemePref>
          value={s.theme}
          onChange={(theme) => s.set({ theme })}
          options={[
            { value: "system", label: t("settings.theme.system") },
            { value: "light", label: t("settings.theme.light") },
            { value: "dark", label: t("settings.theme.dark") },
          ]}
        />
        <label htmlFor="text-scale">
          {t("settings.textScale")}: {Math.round(s.textScale * 100)}%
        </label>
        <input
          id="text-scale"
          type="range"
          min={0.9}
          max={1.5}
          step={0.05}
          value={s.textScale}
          onChange={(e) => s.set({ textScale: Number(e.target.value) })}
        />
      </section>

      <section className="card panel settings-group">
        <h2 style={{ margin: 0 }}>{t("settings.graphics")}</h2>
        <label>{t("settings.quality")}</label>
        <Segmented<QualityPref>
          value={s.quality}
          onChange={(quality) => s.set({ quality })}
          options={[
            { value: "low", label: t("viewer.quality.low") },
            { value: "medium", label: t("viewer.quality.medium") },
            { value: "high", label: t("viewer.quality.high") },
          ]}
        />
        <label>{t("settings.renderMode")}</label>
        <Segmented<ModePref>
          value={s.renderMode}
          onChange={(renderMode) => s.set({ renderMode })}
          options={[
            { value: "classic", label: t("settings.mode.classic") },
            { value: "shaders", label: t("settings.mode.shaders") },
          ]}
        />
      </section>

      <section className="card panel settings-group">
        <h2 style={{ margin: 0 }}>{t("settings.controls")}</h2>
        <label>{t("settings.hand")}</label>
        <Segmented<"right" | "left">
          value={s.hand}
          onChange={(hand) => s.set({ hand })}
          options={[
            { value: "right", label: t("settings.hand.right") },
            { value: "left", label: t("settings.hand.left") },
          ]}
        />
        <Switch
          label={t("settings.cameraButtons")}
          checked={s.cameraButtons}
          onChange={(cameraButtons) => s.set({ cameraButtons })}
        />
        <label>{t("settings.units")}</label>
        <Segmented<Units>
          value={s.units}
          onChange={(units) => s.set({ units })}
          options={[
            { value: "pieces", label: t("materials.pieces") },
            { value: "stacks", label: t("materials.stacks") },
            { value: "shulkers", label: t("materials.shulkers") },
          ]}
        />
      </section>

      <section className="card panel settings-group">
        <h2 style={{ margin: 0 }}>{t("settings.resourcePack")}</h2>
        <p className="small muted" style={{ margin: 0 }}>
          {t("settings.resourcePack.lead")}
        </p>
        <p className="small" style={{ margin: 0 }}>
          {providerInfo
            ? t("settings.resourcePack.active", { name: providerInfo.name, n: providerInfo.count })
            : t("settings.resourcePack.none")}
        </p>
        <div className="row">
          <button className="btn" type="button" onClick={() => fileInput.current?.click()} disabled={rpBusy}>
            {rpBusy ? t("common.loading") : t("settings.resourcePack.choose")}
          </button>
          {providerInfo ? (
            <button
              className="btn ghost"
              type="button"
              onClick={async () => {
                setProvider(null, null);
                await remove("resourcePack", "active");
              }}
            >
              {t("settings.resourcePack.remove")}
            </button>
          ) : null}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".zip,.jar"
          hidden
          onChange={(e) => {
            void loadPack(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Switch
          label={t("settings.resourcePack.remember")}
          checked={s.rememberResourcePack}
          onChange={(v) => void toggleRemember(v)}
        />
      </section>

      <section className="card panel settings-group">
        <h2 style={{ margin: 0 }}>{t("settings.data")}</h2>
        {usage !== null ? (
          <p className="small muted" style={{ margin: 0 }}>
            {t("settings.storage", { size: formatBytes(usage) })}
          </p>
        ) : null}
        <button
          className="btn danger"
          type="button"
          onClick={() => void clear()}
          style={{ alignSelf: "flex-start" }}
        >
          {t("settings.clear")}
        </button>
      </section>
    </div>
  );
}

/** Restores a remembered resource pack at startup. */
export async function restoreResourcePack(): Promise<void> {
  if (!useSettings.getState().rememberResourcePack) return;
  const rec = await getOne("resourcePack", "active");
  if (!rec) return;
  useUi.getState().setProvider(createProvider({ name: rec.name, textures: rec.textures }), {
    name: rec.name,
    count: Object.keys(rec.textures).length,
  });
}
