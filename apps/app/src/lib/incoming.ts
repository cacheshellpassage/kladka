/**
 * Files opened *with* the app:
 * - Android: "Open with" / "Share" from Telegram, Files, Downloads (native IncomingFile plugin);
 * - installed desktop PWA (Chromium): OS file associations via the File Handling API (launchQueue).
 * Every file is imported locally and the build card is opened.
 */
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { importFile } from "./importer";
import { platform } from "../platform/platform";

interface IncomingFilePayload {
  name: string;
  data?: string;
  error?: string;
}

interface IncomingFilePlugin {
  getPending(): Promise<{ file?: IncomingFilePayload }>;
  addListener(event: "incomingFile", cb: (f: IncomingFilePayload) => void): Promise<PluginListenerHandle>;
}

function toFile(p: IncomingFilePayload): File {
  const bin = atob(p.data ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], p.name || "build");
}

export interface IncomingHandlers {
  onStart: (name: string) => void;
  onImported: (buildId: string, count: number) => void;
  onError: (message: string) => void;
}

async function handleFile(file: File, h: IncomingHandlers): Promise<void> {
  h.onStart(file.name);
  try {
    const recs = await importFile(file);
    if (recs[0]) h.onImported(recs[0].id, recs.length);
  } catch (e) {
    h.onError(e instanceof Error ? e.message : String(e));
  }
}

export function listenForIncomingFiles(h: IncomingHandlers): () => void {
  const cleanups: Array<() => void> = [];
  let disposed = false;
  if (platform() === "android") {
    const plugin = registerPlugin<IncomingFilePlugin>("IncomingFile");
    const onPayload = (p: IncomingFilePayload) => {
      if (p.error) h.onError(p.error);
      else if (p.data) void handleFile(toFile(p), h);
    };
    void plugin
      .getPending()
      .then((r) => r.file && onPayload(r.file))
      .catch(() => undefined);
    void plugin
      .addListener("incomingFile", onPayload)
      .then((handle) => {
        // the effect may already have been cleaned up (React StrictMode double mount)
        if (disposed) void handle.remove();
        else cleanups.push(() => void handle.remove());
      })
      .catch(() => undefined);
  }
  const lq = (
    window as unknown as {
      launchQueue?: {
        setConsumer: (cb: (p: { files: Array<{ getFile: () => Promise<File> }> }) => void) => void;
      };
    }
  ).launchQueue;
  lq?.setConsumer(async (params) => {
    for (const handle of params.files ?? []) await handleFile(await handle.getFile(), h);
  });
  return () => {
    disposed = true;
    cleanups.forEach((c) => c());
  };
}
