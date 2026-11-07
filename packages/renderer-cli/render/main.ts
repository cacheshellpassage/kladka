/**
 * Headless render page used by `pnpm render:previews`. Exposes `window.kladkaRender(job)`, which renders
 * a build from the content pack with a fixed composition and returns a data URL.
 */
import { decodeKBuild, planBuild } from "@kladka/voxel-core";
import { VoxelViewer, type TimeOfDay } from "@kladka/viewer";

export interface RenderJob {
  file: string;
  style: "classic" | "cinematic";
  angle: number;
  width: number;
  height: number;
  type?: string;
  quality?: number;
  time?: TimeOfDay;
}

const stage = document.getElementById("stage")!;
const viewer = new VoxelViewer(stage, {
  mode: "classic",
  quality: "high",
  preserveDrawingBuffer: true,
  antialias: true,
  ground: true,
});
let loaded = "";

async function load(file: string): Promise<void> {
  if (loaded === file) return;
  const bytes = new Uint8Array(await (await fetch(file)).arrayBuffer());
  const { model } = decodeKBuild(bytes);
  const plan = planBuild(model);
  await viewer.setModel(model, { stepOf: plan.stepOf, roles: plan.roles });
  loaded = file;
}

declare global {
  interface Window {
    kladkaRender: (job: RenderJob) => Promise<string>;
    kladkaReady: boolean;
  }
}

window.kladkaRender = async (job: RenderJob) => {
  stage.style.width = `${job.width}px`;
  stage.style.height = `${job.height}px`;
  await load(job.file);
  viewer.setStep(null);
  viewer.setClip(null);
  if (job.style === "cinematic") {
    viewer.setMode("shaders");
    viewer.setQuality("high");
    viewer.setTimeOfDay(job.time ?? "sunset");
  } else {
    viewer.setMode("classic");
    viewer.setTheme("light");
  }
  viewer.resetCamera(job.angle);
  viewer.renderNow();
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  return viewer.capture(job.width, job.height, job.type ?? "image/webp", job.quality ?? 0.82);
};
window.kladkaReady = true;
