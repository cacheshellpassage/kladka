/** Animated GIF / WebM export of the build animation. */
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import type { VoxelViewer } from "@kladka/viewer";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = url;
  });
}

/** Renders `frames` evenly spaced build states and encodes an animated GIF. */
export async function buildGif(
  viewer: VoxelViewer,
  totalSteps: number,
  opts: { width?: number; height?: number; frames?: number; onProgress?: (p: number) => void } = {},
): Promise<Uint8Array> {
  const w = opts.width ?? 480,
    h = opts.height ?? 300;
  const frames = Math.max(2, Math.min(opts.frames ?? 48, totalSteps + 1));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const gif = GIFEncoder();
  for (let f = 0; f < frames; f++) {
    const step = f === frames - 1 ? null : Math.floor((f / (frames - 1)) * totalSteps);
    viewer.setStep(step);
    const url = viewer.capture(w, h, "image/png");
    const img = await loadImage(url);
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, w, h, { palette, delay: f === frames - 1 ? 2000 : 120 });
    opts.onProgress?.((f + 1) / frames);
    await new Promise((r) => setTimeout(r, 0));
  }
  viewer.setStep(null);
  gif.finish();
  return gif.bytes();
}

export function videoSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

/** Records the canvas while the build animation plays (WebM). */
export function recordVideo(viewer: VoxelViewer, totalSteps: number, durationMs = 8000): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const stream = viewer.renderer.domElement.captureStream(30);
    const type = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onerror = () => reject(new Error("recording failed"));
    rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    rec.start(250);
    viewer.animateBuild(totalSteps, durationMs, () => setTimeout(() => rec.stop(), 800));
  });
}
