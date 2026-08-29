import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { withSuccessMarker } from "./success-marker-command";

const exerciseSlugs = [
  "02-state-transitions",
  "03-semantic-identifiers",
  "04-boundaries-and-pii",
  "05-workflow-errors",
  "06-effects-and-consistency",
] as const;

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
    const currentSystem = page.locator("#system");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "業務とシステムを引き継ぐ",
    );
    await expect(currentBusiness.locator("dl")).toBeVisible();
    await expect(currentBusiness).toContainText("受付");
    await expect(currentBusiness).toContainText("獣医師");
    await expect(currentBusiness).toContainText("飼い主");
    await expect(currentSystem.locator("table")).toHaveCount(2);
    await expect(currentSystem).toContainText("現在の操作");
    await expect(currentSystem).toContainText("会計担当");
    await expect(currentSystem).toContainText("現在の予約内容");
    await expect(currentSystem).toContainText("不整合の警告");
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

test("/sessions/02-state-transitions/ runs the failure flow before accepting the solution", async ({ page }) => {
  test.setTimeout(150_000);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/sessions/02-state-transitions/");

  const transitionsSolution = await readFile(
    new URL(
      "../../../examples/session-03/src/domain/appointment/transitions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const statusLabelSolution = await readFile(
    new URL(
      "../../../examples/session-03/src/domain/appointment/statusLabel.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const playground = page.locator("#legacy");
  await expect(
    playground.getByRole("textbox", { name: "Editor content" }),
  ).toBeAttached();
  await playground
    .getByRole("button", { name: "修正前の失敗を確認" })
    .click();
  const terminal = playground.locator('[aria-label="コード実行ターミナル"]');
  const runTerminalCommand = async (command: string) => {
    const input = terminal.locator(".xterm-helper-textarea");
    await input.pressSequentially(command);
    await input.press("Enter");
  };
  await expect(terminal).toBeVisible({ timeout: 90_000 });
  await expect(terminal).toContainText(
    "要件未達: 会計済みの来院から診察を開始できない型にしてください。",
    {
      timeout: 30_000,
    },
  );

  const editor = playground.getByRole("textbox", { name: "Editor content" });
  const pasteIntoEditor = async (source: string) => {
    await editor.press("ControlOrMeta+A");
    await page.evaluate(
      async (nextSource) => navigator.clipboard.writeText(nextSource),
      source,
    );
    await editor.press("ControlOrMeta+V");
  };
  const selectFile = async (path: string, expectedSource: string) => {
    await playground.locator(`[data-path="${path}"]`).click();
    await expect(
      playground.locator(`[aria-label="コードエディタ: ${path}"]`),
    ).toBeVisible();
    await expect(playground.locator(".code-explorer__monaco .view-lines")).toContainText(
      expectedSource,
    );
  };

  await selectFile("src/domain/appointment/transitions.ts", "requireKind");
  await pasteIntoEditor(transitionsSolution);
  await expect(playground.locator(".code-explorer__monaco .view-lines")).toContainText(
    "as const satisfies Canceled;",
  );
  await expect(
    playground.locator('[data-path="src/domain/appointment/transitions.ts"]'),
  ).toHaveAttribute(
    "aria-label",
    "src/domain/appointment/transitions.ts、変更あり",
  );

  await selectFile("src/domain/appointment/statusLabel.ts", "toStatusLabel");
  await pasteIntoEditor(statusLabelSolution);
  await expect(playground.locator(".code-explorer__monaco .view-lines")).toContainText(
    "return assertNever(appointment);",
  );
  await expect(
    playground.locator('[data-path="src/domain/appointment/statusLabel.ts"]'),
  ).toHaveAttribute(
    "aria-label",
    "src/domain/appointment/statusLabel.ts、変更あり",
  );

  const typecheck = withSuccessMarker(
    "pnpm exercise:02",
    ["TYPECHECK_", "PASSED"],
  );
  await runTerminalCommand(typecheck.command);
  await expect(terminal).toContainText(typecheck.marker, {
    timeout: 30_000,
  });

  await playground.locator('[data-action="reset"]').click();
  await expect(playground.locator(".code-explorer__monaco .view-lines")).toContainText(
    'return "不明";',
  );
  await expect(
    playground.locator('[data-path="src/domain/appointment/statusLabel.ts"]'),
  ).toHaveAttribute("aria-label", "src/domain/appointment/statusLabel.ts");
  const resetReadback = withSuccessMarker(
    `node -e "const source = require('node:fs').readFileSync('src/domain/appointment/statusLabel.ts', 'utf8'); if (!source.includes('return \\\"不明\\\";')) process.exit(1)"`,
    ["RESET_CONTENT_", "SYNCED"],
  );
  await runTerminalCommand(resetReadback.command);
  await expect(terminal).toContainText(resetReadback.marker);

  const terminalFilePath = "src/terminal-note.ts";
  await runTerminalCommand(
    `node -e "require('node:fs').writeFileSync('${terminalFilePath}', 'export const terminalValue = 1;')"`,
  );
  const terminalFile = playground.locator(`[data-path="${terminalFilePath}"]`);
  await expect(terminalFile).toBeVisible();
  await terminalFile.click();
  await expect(playground.locator(".code-explorer__monaco .view-lines")).toContainText(
    "terminalValue = 1",
  );

  await runTerminalCommand(
    `node -e "require('node:fs').writeFileSync('${terminalFilePath}', 'export const terminalValue = 2;')"`,
  );
  await expect(playground.locator(".code-explorer__monaco .view-lines")).toContainText(
    "terminalValue = 2",
  );

  await runTerminalCommand(
    `node -e "require('node:fs').rmSync('${terminalFilePath}')"`,
  );
  await expect(terminalFile).toHaveCount(0);
  await expect(
    playground.locator(`[aria-label="コードエディタ: ${terminalFilePath}"]`),
  ).toHaveCount(0);
  await expect(
    playground.locator('[aria-label="コードエディタ: exercises/state-modeling.test.ts"]'),
  ).toBeVisible();
  await expect(
    playground.locator('[data-path="exercises/state-modeling.test.ts"]'),
  ).toHaveAttribute("aria-pressed", "true");
});

test("/sessions/02-state-transitions/ stacks design guide cards in one column on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/sessions/02-state-transitions/");

  const cards = page.locator("#legacy .code-guide-cards > [data-code-guide-card]");
  await expect(cards).toHaveCount(2);
  const positions = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const { left, top, width, height } = element.getBoundingClientRect();
      return { left, top, width, height };
    }),
  );
  const [first, second] = positions;
  if (first === undefined || second === undefined) {
    throw new Error("S2 design guide cards are missing");
  }

  expect(second.top).toBeGreaterThan(first.top + first.height);
  expect(second.left).toBe(first.left);
  expect(second.width).toBe(first.width);
});

for (const slug of exerciseSlugs) {
  const route = `/sessions/${slug}/`;
  for (const viewport of viewports) {
    test(`${route} keeps its single failure-flow playground usable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);

      const failureFlow = page.locator("#legacy");
      const playground = failureFlow.locator(".code-explorer");
      expect(await page.evaluate(() => globalThis.crossOriginIsolated)).toBe(true);
      await expect(failureFlow.locator("[data-code-guide-card]")).not.toHaveCount(0);
      await expect(failureFlow.locator(".exercise-failures")).toHaveCount(1);
      await expect(failureFlow.locator(".command-block")).toHaveCount(1);
      await expect(playground).toHaveCount(1);
      await expect(
        failureFlow.getByRole("textbox", { name: "Editor content" }),
      ).toBeAttached();
      await expect(
        failureFlow.getByText("ブラウザ内の変更はローカルへ反映されません。", {
          exact: true,
        }),
      ).toHaveCount(1);
      expect(
        await failureFlow.evaluate((element) => {
          const guide = element.querySelector("[data-code-guide-card]");
          const failures = element.querySelector(".exercise-failures");
          const command = element.querySelector(".command-block");
          const note = Array.from(element.querySelectorAll("p")).find(
            (paragraph) =>
              paragraph.textContent?.trim() ===
              "ブラウザ内の変更はローカルへ反映されません。",
          );
          const explorer = element.querySelector(".code-explorer");
          if (
            guide === null ||
            failures === null ||
            command === null ||
            note === undefined ||
            explorer === null
          ) {
            throw new Error("failure-flow order markers are incomplete");
          }

          const precedes = (before: Element, after: Element) =>
            (before.compareDocumentPosition(after) &
              Node.DOCUMENT_POSITION_FOLLOWING) !==
            0;

          return (
            precedes(guide, failures) &&
            precedes(failures, command) &&
            precedes(command, note) &&
            precedes(note, explorer)
          );
        }),
      ).toBe(true);
      await expect(page.locator("#refactor .session-code-playground")).toHaveCount(0);
      await expect(playground).toBeVisible();
      await expect(playground.locator('[aria-label^="コードエディタ:"]')).toBeVisible();
      await expect(playground.locator('[data-action="reset"]')).toBeVisible();
      await expect(playground.locator('[data-action="run"]')).toHaveCount(0);
      await expect(playground.locator('[data-action="stop"]')).toHaveCount(0);
      await expect(playground.locator('[aria-label="実行結果"]')).toHaveCount(0);
      await expect(
        playground.getByRole("button", { name: "修正前の失敗を確認" }),
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
