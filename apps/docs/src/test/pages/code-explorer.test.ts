import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import CodeExplorerPage from "../../pages/code-explorer.astro";
import { createAstroContainer } from "../render-astro";

const codePlaygroundStyles = readFileSync(
  join(process.cwd(), "src/styles/code-playground.css"),
  "utf8",
);
const codeExplorerPreviewStyles = readFileSync(
  join(process.cwd(), "src/styles/code-explorer-preview.css"),
  "utf8",
);

const previewNotice =
  "これは Session 00 の開始 snapshot を使う実験用プレビューです。編集内容はこのブラウザ内だけで動作し、保存されません。";

describe("code explorer preview page", () => {
  it("keeps the standalone preview dirty indicator pink", () => {
    expect(codePlaygroundStyles).toMatch(
      /\.code-playground\s*\{[^}]*--playground-dirty:\s*var\(--color-pink\)/,
    );
    expect(codePlaygroundStyles).toMatch(
      /\.code-playground \.code-explorer__dirty\s*\{[^}]*background:\s*var\(--playground-dirty\)/,
    );
  });

  it("keeps the preview header link keyboard focus style", () => {
    expect(codeExplorerPreviewStyles).toMatch(
      /\.code-explorer-preview \.code-explorer-preview__header a:focus-visible\s*\{[^}]*outline:\s*0\.25rem solid var\(--color-focus\)[^}]*outline-offset:\s*0\.1875rem/,
    );
  });

  it("renders the self-contained Session 00 snapshot as a load-hydrated standalone preview", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(CodeExplorerPage, {
      partial: false,
    });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector('a[href="/"]')).not.toBeNull();
    expect(document.body.textContent).toContain(previewNotice);
    expect(document.body.textContent).toContain(
      "先人が残した開始 snapshot から、後で確認する設計課題を概観します。",
    );
    expect(document.body.textContent).toContain(
      "src/appointment.ts",
    );
    expect(
      document.querySelector('[data-action="run"]')?.textContent,
    ).toContain("実行");
    expect(
      document.querySelector('[data-action="reset"]')?.textContent,
    ).toContain("リセット");
    expect(
      document.querySelector('[data-code-explorer="00-onboarding"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('astro-island[client="load"]'),
    ).not.toBeNull();
  });
});
