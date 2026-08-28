import { expect, test } from "@playwright/test";
import { sessions } from "../src/sessions/catalog";

const exerciseSessions = sessions.filter(({ kind }) => kind === "exercise");

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1200 },
] as const;

for (const viewport of viewports) {
  test(`/sessions/00-system-handover/ keeps the current-system observation usable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/sessions/00-system-handover/");

    const content = page.locator(".case-file__content");
    const currentBusiness = page.locator("#incident");
    const currentSystem = page.locator("#legacy");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "業務とシステムを引き継ぐ",
    );
    await expect(currentBusiness.locator("dl")).toBeVisible();
    await expect(currentBusiness).toContainText("受付");
    await expect(currentBusiness).toContainText("獣医師");
    await expect(currentBusiness).toContainText("飼い主");
    await expect(currentSystem.locator("table")).toHaveCount(2);
    await expect(currentSystem).toContainText("予約データ");
    await expect(currentSystem).toContainText("カルテ");
    await expect(currentSystem).toContainText("会計データ");
    await expect(currentSystem).toContainText("調査ログ");
    await expect(content.locator(".session-code-overview")).toHaveCount(0);
    await expect(content.locator("[data-code-explorer]")).toHaveCount(0);
    await expect(content.locator(".session-code-playground")).toHaveCount(0);
    await expect(content.locator(".workflow-risk-map")).toHaveCount(0);
    await expect(content.locator('[data-action="run"]')).toHaveCount(0);
    await expect(content.locator('[data-action="reset"]')).toHaveCount(0);
    await expect(content.locator('[aria-label="実行結果"]')).toHaveCount(0);

    const widths = await content.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);
    const pageWidths = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(pageWidths.scrollWidth).toBeLessThanOrEqual(pageWidths.clientWidth + 1);
  });
}

test("/sessions/02-state-transitions/ gives the editor most horizontal space on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/sessions/02-state-transitions/");

  const playground = page.locator(".session-code-playground");
  await expect(playground.locator('[aria-label^="コードエディタ:"]')).toBeVisible();

  const layout = await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>(".case-file__body");
    const playgroundElement = document.querySelector<HTMLElement>(
      ".session-code-playground",
    );
    if (body === null || playgroundElement === null) {
      throw new Error("Playground layout containers are missing");
    }

    const tree = playgroundElement.querySelector<HTMLElement>(
      ".code-explorer__workspace nav",
    );
    const editor = playgroundElement.querySelector<HTMLElement>(
      ".code-explorer__editor",
    );
    const nestedFile = playgroundElement.querySelector<HTMLElement>(
      '[data-path="exercises/state-modeling.test.ts"] > span:first-child',
    );
    if (tree === null || editor === null || nestedFile === null) {
      throw new Error("Playground layout elements are missing");
    }

    return {
      bodyWidth: body.clientWidth,
      playgroundWidth: playgroundElement.clientWidth,
      treeWidth: tree.clientWidth,
      editorWidth: editor.clientWidth,
      treeFontSize: Number.parseFloat(getComputedStyle(tree).fontSize),
      nestedFileHeight: nestedFile.getBoundingClientRect().height,
    };
  });

  expect.soft(layout.bodyWidth).toBeGreaterThanOrEqual(1280);
  expect.soft(layout.playgroundWidth).toBeGreaterThanOrEqual(960);
  expect.soft(layout.treeWidth).toBeLessThanOrEqual(240);
  expect.soft(layout.editorWidth).toBeGreaterThanOrEqual(680);
  expect.soft(layout.editorWidth / layout.treeWidth).toBeGreaterThanOrEqual(2.8);
  expect.soft(layout.treeFontSize).toBeLessThanOrEqual(14);
  expect.soft(layout.nestedFileHeight).toBeLessThanOrEqual(20);

  const startTerminal = playground.getByRole("button", {
    name: "ターミナルを起動",
  });
  const startButtonHeight = await startTerminal.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect.soft(startButtonHeight).toBeGreaterThanOrEqual(40);
});

test("/sessions/02-state-transitions/ runs arbitrary commands and reflects created files", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/sessions/02-state-transitions/");

  const playground = page.locator(".session-code-playground");
  await expect(
    playground.getByRole("textbox", { name: "Editor content" }),
  ).toBeAttached();
  await playground
    .getByRole("button", { name: "ターミナルを起動" })
    .click();
  await expect(playground.locator(".code-explorer__terminal")).not.toHaveAttribute(
    "data-state",
    "unstarted",
  );
  const terminal = playground.locator('[aria-label="コード実行ターミナル"]');
  await expect(terminal).toBeVisible({ timeout: 90_000 });

  const terminalInput = terminal.locator(".xterm-helper-textarea");
  await terminalInput.focus();
  await page.keyboard.type("echo __CODEX_TERMINAL_4'2'__");
  await page.keyboard.press("Enter");
  await expect(terminal).toContainText("__CODEX_TERMINAL_42__", {
    timeout: 10_000,
  });

  await terminalInput.focus();
  await page.keyboard.type(
    "echo 'created from terminal' > src/created.txt && echo __FILE_4'2'__",
  );
  await page.keyboard.press("Enter");
  await expect(terminal).toContainText("__FILE_42__", { timeout: 10_000 });

  await terminalInput.focus();
  await page.keyboard.type("ls src/created.txt && echo __LIST_4'2'__");
  await page.keyboard.press("Enter");
  await expect(terminal).toContainText("__LIST_42__", { timeout: 10_000 });
  const createdFile = playground.locator('[data-path="src/created.txt"]');
  await expect(createdFile).toBeVisible({ timeout: 10_000 });
  await createdFile.click();
  await expect(
    playground.locator('[aria-label="コードエディタ: src/created.txt"]'),
  ).toBeVisible();

  const editorInput = playground.getByRole("textbox", {
    name: "Editor content",
  });
  await editorInput.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("edited-from-monaco");

  await terminalInput.focus();
  await page.keyboard.type("cat src/created.txt && echo __CAT_4'2'__");
  await page.keyboard.press("Enter");
  await expect(terminal).toContainText("edited-from-monaco", {
    timeout: 10_000,
  });
  await expect(terminal).toContainText("__CAT_42__", { timeout: 10_000 });

  await terminalInput.focus();
  await page.keyboard.type(
    "echo terminal-updated > src/created.txt && echo __UPDATE_4'2'__",
  );
  await page.keyboard.press("Enter");
  await expect(terminal).toContainText("__UPDATE_42__", { timeout: 10_000 });
  await expect(playground.locator(".code-explorer__monaco .view-lines")).toContainText(
    "terminal-updated",
    { timeout: 10_000 },
  );

  await terminalInput.focus();
  await page.keyboard.type("rm src/created.txt && echo __DELETE_4'2'__");
  await page.keyboard.press("Enter");
  await expect(terminal).toContainText("__DELETE_42__", { timeout: 10_000 });
  await expect(createdFile).toHaveCount(0, { timeout: 10_000 });

  await terminalInput.focus();
  await page.keyboard.type("pnpm exercise:02");
  await page.keyboard.press("Enter");
  await expect(terminal).toContainText(/Tests\s+4 failed/, {
    timeout: 30_000,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const terminalLayout = await terminal.evaluate((element) => {
    const screen = element.querySelector<HTMLElement>(".xterm-screen");
    if (screen === null) throw new Error("xterm screen is missing");
    return {
      hostWidth: element.clientWidth,
      hostHeight: element.clientHeight,
      screenWidth: screen.getBoundingClientRect().width,
      screenHeight: screen.getBoundingClientRect().height,
    };
  });
  expect(terminalLayout.screenWidth).toBeLessThanOrEqual(
    terminalLayout.hostWidth + 1,
  );
  expect(terminalLayout.screenHeight).toBeLessThanOrEqual(
    terminalLayout.hostHeight + 1,
  );
  const pageWidths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(pageWidths.scrollWidth).toBeLessThanOrEqual(pageWidths.clientWidth + 1);
});

for (const session of exerciseSessions) {
  const route = `/sessions/${session.slug}/`;
  for (const viewport of viewports) {
    test(`${route} keeps the playground usable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);

      const playground = page.locator(".session-code-playground");
      expect(await page.evaluate(() => globalThis.crossOriginIsolated)).toBe(true);
      await expect(playground).toBeVisible();
      await expect(playground.locator('[aria-label^="コードエディタ:"]')).toBeVisible();
      await expect(playground.locator('[data-action="reset"]')).toBeVisible();
      await expect(playground.locator('[data-action="run"]')).toHaveCount(0);
      await expect(playground.locator('[data-action="stop"]')).toHaveCount(0);
      await expect(playground.locator('[aria-label="実行結果"]')).toHaveCount(0);
      await expect(
        playground.getByRole("button", { name: "ターミナルを起動" }),
      ).toBeVisible();
      const widths = await playground.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);
      const pageWidths = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(pageWidths.scrollWidth).toBeLessThanOrEqual(pageWidths.clientWidth + 1);
    });
  }
}
