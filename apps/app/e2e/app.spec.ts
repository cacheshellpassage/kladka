import { expect, test, type Page, type Request } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  exportModel,
  importBytes,
  state,
  VoxelModel,
  minecraftJava,
  MC_DATA_VERSION,
} from "@kladka/voxel-core";
import { testResourcePack } from "./fixtures";

const ORIGIN = "http://127.0.0.1:4173";
const external: string[] = [];

function watchNetwork(page: Page): void {
  page.on("request", (r: Request) => {
    const url = r.url();
    if (url.startsWith(ORIGIN) || url.startsWith("data:") || url.startsWith("blob:")) return;
    external.push(url);
  });
}

async function openBuild(page: Page, id: string): Promise<void> {
  await page.goto(`/#/b/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  watchNetwork(page);
});

test.afterAll(() => {
  // The app must never talk to the network.
  expect(external, `unexpected network requests: ${external.join(", ")}`).toEqual([]);
});

test("catalog lists the built-in builds and filters them", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator('[data-testid^="build-"]');
  await expect(cards).toHaveCount(36);
  await page.getByRole("searchbox").fill("маяк");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Маяк");
  await page.getByRole("searchbox").fill("");
  await expect(cards).toHaveCount(36);
});

test("step-by-step guide advances and remembers progress", async ({ page }) => {
  await openBuild(page, "starter-hut");
  await page.getByTestId("start-guide").click();
  await expect(page.getByTestId("guide")).toBeVisible();
  const label = page.getByTestId("step-label");
  await expect(label).toContainText("Шаг 1 из");
  for (let i = 0; i < 3; i++) await page.getByTestId("done").click();
  await expect(label).toContainText("Шаг 4 из");
  await page.getByTestId("prev").click();
  await expect(label).toContainText("Шаг 3 из");
  await page.keyboard.press("ArrowRight");
  await expect(label).toContainText("Шаг 4 из");
  await page.waitForTimeout(600); // progress is saved with a short debounce
  await page.reload();
  await expect(page.getByTestId("step-label")).toContainText("Шаг 4 из");
  // the catalog shows progress for the build
  await page.goto("/");
  await expect(page.getByTestId("build-starter-hut").locator(".progressbar")).toBeVisible();
});

test("exports a built-in build as .litematic that round-trips", async ({ page }) => {
  await openBuild(page, "well");
  await expect(page.getByTestId("export")).toBeEnabled();
  await page.getByTestId("export").click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[data-format="litematic"]').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.litematic$/);
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const res = importBytes(new Uint8Array(readFileSync(path!)), download.suggestedFilename());
  expect(res.format).toBe("litematic");
  expect(res.model.countBlocks()).toBeGreaterThan(50);
});

test("imports a user .schem file and exports it again", async ({ page }) => {
  const m = new VoxelModel(
    { x: 5, y: 4, z: 5 },
    { dataVersion: MC_DATA_VERSION, materialOf: minecraftJava.materialOf },
  );
  for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) m.set(x, 0, z, state("stone_bricks"));
  for (let y = 1; y < 4; y++)
    for (let x = 0; x < 5; x++)
      for (let z = 0; z < 5; z++)
        if (x === 0 || z === 0 || x === 4 || z === 4) m.set(x, y, z, state("oak_planks"));
  m.set(2, 2, 4, state("glass_pane"));
  minecraftJava.finalize(m);
  const bytes = exportModel(m, "schem").bytes;

  await page.goto("/#/import");
  await page.getByTestId("import-input").setInputFiles({
    name: "test-tower.schem",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(bytes),
  });
  await expect(page).toHaveURL(/#\/b\/imp-/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("test-tower");
  await expect(page.getByText("Блоков")).toBeVisible();

  await page.getByTestId("start-guide").click();
  await expect(page.getByTestId("step-label")).toContainText("Шаг 1 из");
  await page.goBack();

  await expect(page.getByTestId("export")).toBeEnabled();
  await page.getByTestId("export").click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[data-format="nbt"]').click(),
  ]);
  const { readFileSync } = await import("node:fs");
  const back = importBytes(new Uint8Array(readFileSync((await download.path())!)), "x.nbt");
  expect(back.model.countBlocks()).toBe(m.countBlocks());

  // imported build shows up in the catalog
  await page.goto("/");
  await expect(page.locator('[data-testid^="build-imp-"]')).toHaveCount(1);
});

test("loads a user resource pack locally", async ({ page }) => {
  await page.goto("/#/settings");
  await page.getByTestId("resource-pack-input").setInputFiles({
    name: "test-pack.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(testResourcePack()),
  });
  await expect(page.getByText("test-pack.zip (2")).toBeVisible();
  await openBuild(page, "oak-cottage");
  await page.getByRole("link", { name: /3D/ }).click();
  await expect(page.getByTestId("view-page")).toBeVisible();
});

test("in-game mode: big buttons advance the step and the mode is remembered", async ({ page }) => {
  await page.goto("/#/b/well/guide");
  await page.getByTestId("enter-game").click();
  await expect(page.getByTestId("game-mode")).toBeVisible();
  const num = page.locator(".gm-num");
  await expect(num).toHaveText("1");
  await page.getByTestId("game-done").click();
  await expect(num).toHaveText("2");
  await page.reload();
  await expect(page.getByTestId("game-mode")).toBeVisible();
  await page.getByRole("button", { name: /Выйти из режима/ }).click();
  await expect(page.getByTestId("guide")).toBeVisible();
});

test("materials checklist is saved per build", async ({ page }) => {
  await openBuild(page, "fountain");
  const boxes = page.locator("input.check");
  await expect(boxes.first()).toBeVisible();
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await expect(page.getByText(/Собрано 2 из/)).toBeVisible();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByText(/Собрано 2 из/)).toBeVisible();
  await expect(page.locator("input.check").nth(0)).toBeChecked();
});

test("free 3D view: section and layer controls", async ({ page }) => {
  await page.goto("/#/b/watchtower/view");
  await expect(page.getByTestId("view-page")).toBeVisible();
  const slider = page.getByTestId("layers-slider");
  await slider.fill("5");
  await expect(page.getByText("Слои до Y: 5")).toBeVisible();
});

const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
];

test("visual snapshots on phone, tablet and desktop", async ({ page }) => {
  const dir = join(test.info().outputDir, "..", "screens");
  mkdirSync(dir, { recursive: true });
  for (const s of SIZES) {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto("/");
    await expect(page.locator('[data-testid^="build-"]').first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(dir, `${s.name}-catalog.png`) });
    await openBuild(page, "medieval-house");
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(dir, `${s.name}-build.png`), fullPage: true });
    await page.goto("/#/b/medieval-house/guide");
    await expect(page.getByTestId("step-label")).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(dir, `${s.name}-guide.png`) });
    // nothing overflows horizontally
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${s.name}: horizontal overflow`).toBeLessThanOrEqual(1);
  }
});
