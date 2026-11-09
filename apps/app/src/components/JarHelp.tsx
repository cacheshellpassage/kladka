/**
 * Step-by-step help for loading textures from the user's own game install (client.jar), with the
 * `versions` folder of popular launchers for every OS and a "copy path" button. The desktop app can open
 * the native dialog right in that folder; a browser cannot, so there the user pastes the copied path into
 * the file dialog (Windows: "File name" field, macOS: ⌘⇧G, Linux: Ctrl+L).
 */
import { useState } from "react";
import { useT, type MessageKey } from "../i18n";
import { detectOs, pickGameJar, platform, type DesktopOs } from "../platform/platform";
import { useUi } from "../store/ui";
import { Segmented } from "./Common";
import { Icon } from "./Icon";

const PATHS: Record<Exclude<DesktopOs, "phone">, Array<{ label: MessageKey; path: string }>> = {
  windows: [
    { label: "jar.launcher.official", path: "%APPDATA%\\.minecraft\\versions" },
    {
      label: "jar.launcher.tlauncherLegacy",
      path: "%APPDATA%\\.tlauncher\\legacy\\Minecraft\\game\\versions",
    },
    { label: "jar.launcher.prism", path: "%APPDATA%\\PrismLauncher\\libraries\\com\\mojang\\minecraft" },
    { label: "jar.launcher.curseforge", path: "%USERPROFILE%\\curseforge\\minecraft\\Install\\versions" },
  ],
  mac: [
    { label: "jar.launcher.official", path: "~/Library/Application Support/minecraft/versions" },
    {
      label: "jar.launcher.prism",
      path: "~/Library/Application Support/PrismLauncher/libraries/com/mojang/minecraft",
    },
  ],
  linux: [
    { label: "jar.launcher.official", path: "~/.minecraft/versions" },
    { label: "jar.launcher.prism", path: "~/.local/share/PrismLauncher/libraries/com/mojang/minecraft" },
  ],
};

export function JarHelp({ onFile, busy }: { onFile: (f: File | undefined) => void; busy?: boolean }) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  const [os, setOs] = useState<DesktopOs>(detectOs());
  const desktopApp = platform() === "tauri";

  const copy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      showToast(t("jar.copied"));
    } catch {
      /* clipboard unavailable: the path is selectable text */
    }
  };

  return (
    <details className="jar-help" open>
      <summary>
        <Icon name="help" size={18} /> {t("jar.title")}
      </summary>
      <p className="small muted">{t("jar.intro")}</p>
      <Segmented<DesktopOs>
        label={t("jar.title")}
        value={os}
        onChange={setOs}
        options={[
          { value: "windows", label: t("jar.os.windows") },
          { value: "mac", label: t("jar.os.mac") },
          { value: "linux", label: t("jar.os.linux") },
          { value: "phone", label: t("jar.os.phone") },
        ]}
      />
      {os === "phone" ? (
        <p className="small">{t("jar.phone")}</p>
      ) : (
        <>
          {desktopApp ? (
            <button
              className="btn primary"
              type="button"
              disabled={busy}
              onClick={() => void pickGameJar().then(onFile, () => onFile(undefined))}
            >
              <Icon name="import" /> {t("jar.openFolder")}
            </button>
          ) : null}
          <ol className="jar-steps small">
            {desktopApp ? <li>{t("jar.step.desktop")}</li> : null}
            <li>{t("jar.step.copy")}</li>
            <li>{t("jar.step.choose")}</li>
            <li>{t(`jar.step.paste.${os}` as MessageKey)}</li>
            <li>{t("jar.step.pick")}</li>
          </ol>
          <div className="jar-paths">
            <span className="small muted">{t("jar.paths")}</span>
            {PATHS[os].map((p) => (
              <div key={p.path} className="jar-path">
                <span className="small">{t(p.label)}</span>
                <code>{p.path}</code>
                <button
                  className="btn icon ghost"
                  type="button"
                  onClick={() => void copy(p.path)}
                  title={t("jar.copy")}
                  aria-label={`${t("jar.copy")}: ${t(p.label)}`}
                >
                  <Icon name="copy" />
                </button>
              </div>
            ))}
          </div>
          <p className="small muted">{t("jar.prismNote")}</p>
        </>
      )}
    </details>
  );
}
