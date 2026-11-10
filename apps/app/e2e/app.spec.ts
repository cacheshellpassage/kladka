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
  await expect(page.getByText("Блоков", { exact: true })).toBeVisible();

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

test("build passport shows block types, versions and mods", async ({ page }) => {
  await openBuild(page, "pagoda");
  const passport = page.getByTestId("passport");
  await expect(passport).toBeVisible();
  await expect(passport).toContainText("Java 1.20");
  await expect(passport).toContainText("Java 26.3");
  await expect(passport).toContainText("не нужны");
});

test("free 3D view: block info, measuring and fly camera", async ({ page }) => {
  await page.goto("/#/b/well/view");
  await expect(page.getByTestId("view-page")).toBeVisible();
  const canvas = page.locator(".viewer-host canvas");
  await page.waitForTimeout(1500);
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  // tap somewhere on the build until a block is hit
  const hit = async () => {
    for (const [dx, dy] of [
      [0, 0],
      [0, 30],
      [0, 60],
      [-30, 40],
      [30, 40],
    ] as Array<[number, number]>) {
      await page.mouse.click(cx + dx, cy + dy);
      await page.waitForTimeout(150);
      if ((await page.locator(".block-panel, .measure-size").count()) > 0) return true;
      if (await page.getByText("Теперь нажмите").isVisible()) return true;
    }
    return false;
  };
  expect(await hit()).toBe(true);
  await expect(page.locator(".block-panel")).toContainText("ID для команд");
  await page.getByRole("button", { name: "Измерить" }).click();
  await expect(page.getByText("Нажмите на блок в одном углу")).toBeVisible();
  await page.getByRole("button", { name: "Полёт" }).click();
  await expect(page.locator(".fly-pad")).toBeVisible();
  await page.getByRole("button", { name: "Вращение" }).click();
  await expect(page.locator(".fly-pad")).toHaveCount(0);
});

test("free 3D view: section and layer controls", async ({ page }) => {
  await page.goto("/#/b/watchtower/view");
  await expect(page.getByTestId("view-page")).toBeVisible();
  const slider = page.getByTestId("layers-slider");
  await slider.fill("5");
  await expect(page.getByText("Слои до Y: 5")).toBeVisible();
});

test("the last step ends with a finish card that leads somewhere", async ({ page }) => {
  await page.goto("/#/b/starter-hut/guide");
  await expect(page.getByTestId("step-label")).toContainText("Шаг 1 из");
  // jump to the last stage and finish it
  await page.locator(".stage-list button").last().click();
  for (let i = 0; i < 60 && !(await page.getByTestId("finish-catalog").isVisible()); i++)
    await page.getByTestId("done").click();
  await expect(page.locator(".finish-card")).toBeVisible();
  await expect(page.getByTestId("step-label")).toHaveText("Все шаги пройдены");
  await expect(page.locator(".finish-card").getByRole("link", { name: /3D/ })).toBeVisible();
  await page.getByTestId("finish-catalog").click();
  await expect(page.locator('[data-testid^="build-"]').first()).toBeVisible();
});

test("plan letters are the same in the step card and the material list", async ({ page }) => {
  await page.goto("/#/b/mini-castle/guide");
  await expect(page.getByTestId("step-label")).toContainText("Шаг 1 из");
  const inCard = page.locator(".step-mats li").first();
  await expect(inCard.locator(".plan-sym")).toHaveText(/^[A-Za-z0-9]$/);
  const letter = await inCard.locator(".plan-sym").innerText();
  const name = await inCard.locator(".nm").innerText();
  await expect(page.locator(".mats tr", { hasText: name }).first().locator(".plan-sym")).toHaveText(letter);
  // the plan can be zoomed to the blocks of the step and back
  const zoom = page.locator(".plan-zoom");
  await expect(zoom).toHaveAttribute("aria-pressed", "false");
  await zoom.click();
  await expect(zoom).toHaveAttribute("aria-pressed", "true");
});

test("the plan moves like a map and identical parts share a step", async ({ page }) => {
  await page.goto("/#/b/mini-castle/guide");
  await expect(page.getByTestId("step-label")).toContainText("Шаг 1 из");
  const host = page.locator(".plan-wrap .plan-host");
  const picture = () => host.locator("canvas").evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  await expect(host.locator("canvas")).toBeVisible();
  await expect(page.locator(".plan-reset")).toHaveCount(0);
  const box = (await host.boundingBox())!;
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  const drag = async (dx: number, dy: number) => {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
    await page.mouse.up();
  };

  // the wheel zooms in around the cursor, a drag then moves the window, the button brings the layer back
  const whole = await picture();
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -600);
  await expect(page.locator(".plan-reset")).toBeVisible();
  await expect(host).toHaveAttribute("data-grab", "1");
  await expect.poll(picture).not.toBe(whole);
  const zoomed = await picture();
  await drag(-130, -70);
  await expect.poll(picture).not.toBe(zoomed);
  await page.locator(".plan-reset").click();
  await expect(page.locator(".plan-reset")).toHaveCount(0);
  await expect.poll(picture).toBe(whole);

  // four towers of the castle are one step, not four
  for (let i = 0; i < 80 && !(await page.getByTestId("copies-hint").isVisible()); i++)
    await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("copies-hint")).toContainText("Одинаковых частей: ");

  // "in the game": a drag across the plan is a swipe until the plan is zoomed by hand
  await page.getByTestId("enter-game").click();
  const num = page.locator(".gm-num");
  const before = Number(await num.innerText());
  const gm = (await page.locator(".gm-visual .plan-host").boundingBox())!;
  const swipe = async () => {
    await page.mouse.move(gm.x + gm.width * 0.7, gm.y + gm.height / 2);
    await page.mouse.down();
    await page.mouse.move(gm.x + gm.width * 0.7 - 160, gm.y + gm.height / 2 + 4, { steps: 5 });
    await page.mouse.up();
  };
  await swipe();
  await expect(num).toHaveText(String(before + 1));
  await page.mouse.dblclick(gm.x + gm.width / 2, gm.y + gm.height / 2);
  await expect(page.locator(".plan-reset")).toBeVisible();
  await swipe();
  await expect(num).toHaveText(String(before + 1));
});

test("a phone gets one view at a time and a sideways layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/b/mini-castle/guide");
  await expect(page.getByTestId("step-label")).toBeVisible();
  await expect(page.getByRole("button", { name: "3D + схема" })).toHaveCount(0);
  await expect(page.locator(".plan-wrap")).toHaveCount(0); // the default "3D + plan" becomes 3D
  await page.getByRole("button", { name: "Схема", exact: true }).click();
  await expect(page.locator(".plan-wrap canvas")).toBeVisible();
  await expect(page.locator(".guide .viewer-host")).toHaveCount(0);

  // held sideways: the picture on the left, the step on the right, no top bar
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator(".topbar")).toBeHidden();
  const stage = (await page.locator(".guide-stage").boundingBox())!;
  const side = (await page.locator(".guide-side").boundingBox())!;
  expect(side.x).toBeGreaterThanOrEqual(stage.x + stage.width - 1);
  expect(stage.height).toBeGreaterThan(380);
  await expect(page.getByTestId("done")).toBeInViewport();

  await page.getByTestId("enter-game").click();
  const visual = (await page.locator(".gm-visual").boundingBox())!;
  expect(visual.height).toBeGreaterThan(300);
  await expect(page.getByTestId("game-done")).toBeInViewport();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
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
