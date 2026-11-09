/**
 * Platform helpers: detect Tauri / Capacitor and save files appropriately.
 * - Web/PWA: download via an <a download> link.
 * - Tauri (desktop): native "Save as" dialog + fs plugin.
 * - Capacitor (Android): write to the app cache and open the system share sheet
 *   (the user picks "Save to Files", Telegram, etc.).
 */
import { Capacitor } from "@capacitor/core";

export type PlatformKind = "web" | "tauri" | "android";

export function platform(): PlatformKind {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) return "tauri";
  try {
    if (Capacitor.isNativePlatform()) return "android";
  } catch {
    /* not native */
  }
  return "web";
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

export async function saveFile(
  name: string,
  bytes: Uint8Array,
  mime = "application/octet-stream",
): Promise<string> {
  const kind = platform();
  if (kind === "tauri") {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
    const path = await save({
      defaultPath: name,
      filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : [],
    });
    if (!path) throw new Error("cancelled");
    await writeFile(path, bytes);
    return path;
  }
  if (kind === "android") {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const res = await Filesystem.writeFile({ path: name, data: toBase64(bytes), directory: Directory.Cache });
    await Share.share({ title: name, files: [res.uri] });
    return name;
  }
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}

export async function saveDataUrl(name: string, dataUrl: string): Promise<string> {
  const comma = dataUrl.indexOf(",");
  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return saveFile(name, bytes, mime);
}

export async function saveBlob(name: string, blob: Blob): Promise<string> {
  return saveFile(name, new Uint8Array(await blob.arrayBuffer()), blob.type);
}

export function safeFileName(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 60) || "build"
  );
}

/**
 * Opens a web page in the system browser (schematic sites, docs). The app itself never loads remote
 * content; the page opens outside the app.
 */
export async function openExternal(url: string): Promise<void> {
  const kind = platform();
  if (kind === "tauri") {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  if (kind === "android") {
    // Capacitor hands navigation to a non-app URL over to the system browser
    window.location.assign(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export type DesktopOs = "windows" | "mac" | "linux" | "phone";

/** Best guess of the user's OS for showing the right game folder. */
export function detectOs(): DesktopOs {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return "phone";
  if (/Mac OS X|Macintosh/i.test(ua)) return "mac";
  if (/Windows/i.test(ua)) return "windows";
  return "linux";
}

/**
 * Desktop app only: opens the native "Open" dialog directly in the game's `versions` folder and reads the
 * chosen .jar/.zip. Returns undefined when cancelled. Not available in the browser (a web page cannot
 * open a dialog in a given folder), where the user pastes the folder path into the dialog instead.
 */
export async function pickGameJar(): Promise<File | undefined> {
  if (platform() !== "tauri") return undefined;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const { dataDir, homeDir, join } = await import("@tauri-apps/api/path");
  const os = detectOs();
  let defaultPath: string | undefined;
  try {
    defaultPath =
      os === "windows"
        ? await join(await dataDir(), ".minecraft", "versions")
        : os === "mac"
          ? await join(await dataDir(), "minecraft", "versions")
          : await join(await homeDir(), ".minecraft", "versions");
  } catch {
    defaultPath = undefined;
  }
  const path = await open({
    defaultPath,
    multiple: false,
    directory: false,
    filters: [{ name: "client.jar / resource pack", extensions: ["jar", "zip"] }],
  });
  if (!path || Array.isArray(path)) return undefined;
  const bytes = await readFile(path);
  const name = path.split(/[\\/]/).pop() ?? "client.jar";
  return new File([bytes as BlobPart], name);
}
