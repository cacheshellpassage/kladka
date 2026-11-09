/**
 * `pnpm render:previews [ids...] [--angles=0,1,2,3,4] [--styles=classic,cinematic] [--out=dir]` (4 = top view)
 *
 * Renders cover images for every build of the core pack with the same composition (same sky, light
 * and framing) and writes them next to the pack, updating pack.json. Uses a locally installed
 * Microsoft Edge / Chrome, or the Playwright Chromium build in CI, in headless mode with software WebGL.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium, type Browser } from "playwright-core";
import type { ContentPackManifest } from "@kladka/voxel-core";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "../../..");
const PUBLIC = join(ROOT, "apps/app/public");
const PACK_DIR = join(PUBLIC, "packs/core");

const COVER = { width: 800, height: 500, quality: 0.8 };
const THUMB = { width: 384, height: 240, quality: 0.8 };

function arg(name: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a?.slice(name.length + 3);
}

export async function launchBrowser(): Promise<Browser> {
  const args = [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ];
  const channel = process.env.KLADKA_BROWSER_CHANNEL;
  const candidates: Array<() => Promise<Browser>> = [];
  if (channel) candidates.push(() => chromium.launch({ channel, headless: true, args }));
  candidates.push(() => chromium.launch({ headless: true, args }));
  candidates.push(() => chromium.launch({ channel: "msedge", headless: true, args }));
  candidates.push(() => chromium.launch({ channel: "chrome", headless: true, args }));
  let lastErr: unknown;
  for (const c of candidates) {
    try {
      return await c();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Windows may briefly lock a file (antivirus, the dev server's watcher): retry a few times. */
async function writeRetry(path: string, data: string | Buffer): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      writeFileSync(path, data);
      return;
    } catch (e) {
      if (attempt >= 8) throw e;
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }
}

function dataUrlToBytes(url: string): Buffer {
  return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
}

async function main(): Promise<void> {
  const manifestPath = join(PACK_DIR, "pack.json");
  if (!existsSync(manifestPath)) throw new Error("pack.json not found, run pnpm content:build first");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ContentPackManifest;
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const angles = (arg("angles") ?? "0,1,2,3,4").split(",").map(Number);
  const styles = (arg("styles") ?? "classic,cinematic").split(",") as Array<"classic" | "cinematic">;
  const outDir = arg("out");

  const server = await createServer({
    root: join(here, "../render"),
    publicDir: PUBLIC,
    logLevel: "error",
    server: { port: 0, host: "127.0.0.1" },
    configFile: false,
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0] ?? "http://127.0.0.1:5173/";
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on("console", (m) => {
    if (m.type() === "error") console.error("[page]", m.text());
  });
  page.on("pageerror", (e) => console.error("[page error]", e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.kladkaReady === true, null, { timeout: 120_000 });

  const t0 = Date.now();
  for (const b of manifest.builds) {
    if (only.length && !only.includes(b.id)) continue;
    const base = outDir ?? PACK_DIR;
    mkdirSync(join(base, "previews", b.id), { recursive: true });
    const previews = b.previews ?? {};
    for (const style of styles) {
      // keep angles rendered earlier: `--angles=4` adds the top view without touching the others
      const list: string[] = [...((style === "classic" ? previews.classic : previews.cinematic) ?? [])];
      for (const angle of angles) {
        const dataUrl = await page.evaluate((job) => window.kladkaRender(job), {
          file: `/packs/core/${b.file}`,
          style,
          angle,
          width: COVER.width,
          height: COVER.height,
          quality: COVER.quality,
        });
        const rel = `previews/${b.id}/${style}-${angle}.webp`;
        await writeRetry(join(base, rel), dataUrlToBytes(dataUrl));
        list[angle] = rel;
      }
      if (!angles.includes(0)) {
        if (style === "classic") previews.classic = list;
        else previews.cinematic = list;
        continue;
      }
      const thumbUrl = await page.evaluate((job) => window.kladkaRender(job), {
        file: `/packs/core/${b.file}`,
        style,
        angle: 0,
        width: THUMB.width,
        height: THUMB.height,
        quality: THUMB.quality,
      });
      const thumbRel = `previews/${b.id}/${style}-thumb.webp`;
      await writeRetry(join(base, thumbRel), dataUrlToBytes(thumbUrl));
      if (style === "classic") {
        previews.classic = list;
        previews.thumb = thumbRel;
      } else {
        previews.cinematic = list;
        previews.thumbCinematic = thumbRel;
      }
    }
    b.previews = previews;
    console.log(`${b.id.padEnd(20)} done (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    if (!outDir) await writeRetry(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }
  await browser.close();
  await server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
