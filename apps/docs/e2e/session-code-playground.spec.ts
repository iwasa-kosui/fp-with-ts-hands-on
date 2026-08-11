import { expect, test } from "@playwright/test";

const incrementalRoutes = [
  "/sessions/00-onboarding/",
  "/sessions/01-invariants/",
  "/sessions/02-state-vocabulary/",
  "/sessions/03-state-transitions/",
  "/sessions/04-awaiting-payment/",
  "/sessions/05-cancellation/",
  "/sessions/06-input-boundary/",
  "/sessions/07-meaningful-values/",
  "/sessions/08-pii-output/",
  "/sessions/09-typed-failures/",
  "/sessions/10-success-events/",
  "/sessions/11-use-case-ports/",
  "/sessions/12-atomicity-and-conflicts/",
  "/sessions/13-safe-follow-up/",
] as const;

const finalRoute = "/sessions/final/";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1200 },
] as const;

for (const route of incrementalRoutes) {
  for (const viewport of viewports) {
    test(`${route} keeps the playground usable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);

      const playground = page.locator(".session-code-playground");
      const editor = playground.getByRole("region", {
        name: /コードエディタ:/,
      });
      await expect(playground).toBeVisible();
      await expect(editor).toBeVisible();
      const monacoEditor = editor.locator(".monaco-editor");
      await expect(monacoEditor).toBeVisible();
      const editorHeight = await monacoEditor.evaluate(
        (element) => element.getBoundingClientRect().height,
      );
      expect(editorHeight).toBeGreaterThan(200);
      await expect(playground.locator('[data-action="reset"]')).toBeVisible();
      await expect(playground.locator('[data-action="run"]')).toBeVisible();
      await expect(
        playground.getByRole("button", { name: "選択中のファイルをリセット" }),
      ).toBeVisible();
      await expect(playground.getByRole("button", { name: "実行" })).toBeVisible();
      await expect(playground.locator('[aria-label="実行結果"]')).toBeVisible();
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

for (const viewport of viewports) {
  test(`${finalRoute} keeps the reference tour read-only on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(finalRoute);

    const playground = page.locator(".session-code-playground");
    const editor = playground.getByRole("region", { name: /コードエディタ:/ });
    await expect(playground).toBeVisible();
    await expect(editor.locator(".monaco-editor")).toBeVisible();
    await expect(playground.locator("[data-code-guide]")).toHaveCount(5);
    await expect(playground.locator('[data-guide-path="src/domain/appointment/appointment.ts"]')).toBeVisible();
    await expect(playground.locator('[data-guide-path="src/domain/shared/schemaResult.ts"]')).toBeVisible();
    await expect(playground.locator('[data-guide-path="src/useCase/startExaminationUseCase.ts"]')).toBeVisible();
    await expect(playground.locator('[data-guide-path="src/adaptor/secondary/sqlite/store/appointmentEventStore.ts"]')).toBeVisible();
    await expect(playground.locator('[data-guide-path="src/adaptor/primary/web/routes/appointmentRoutes.ts"]')).toBeVisible();
    const readOnlyTextArea = editor.locator("textarea");
    await expect(readOnlyTextArea).toHaveAttribute("readonly");
    await expect(readOnlyTextArea).toHaveJSProperty("readOnly", true);
    await expect(playground.locator(".code-explorer__file-tree")).toHaveCount(0);
    await expect(playground.locator('[data-action="run"]')).toHaveCount(0);
    await expect(playground.locator('[data-action="reset"]')).toHaveCount(0);
    await expect(playground.locator('[data-action="stop"]')).toHaveCount(0);
    await expect(playground.locator('[aria-label="実行結果"]')).toHaveCount(0);
  });
}
