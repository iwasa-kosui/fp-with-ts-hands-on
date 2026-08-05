import { markHTMLString } from "astro/runtime/server/index.js";
import { describe, expect, it } from "vitest";
import CommandBlock from "../../components/CommandBlock.astro";
import ModuleLayout from "../../layouts/ModuleLayout.astro";
import { modules } from "../../modules/catalog";
import { createAstroContainer } from "../render-astro";

describe("ModuleLayout", () => {
  it("renders the case file hero, authored toc, body, and module navigation", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(ModuleLayout, {
      props: { module: modules[2] },
      slots: {
        toc: markHTMLString('<ol><li><a href="#mission">ミッション</a></li></ol>'),
        default: markHTMLString('<section id="mission"><h2>ミッション</h2></section>'),
      },
    });

    expect(html).toContain("MODULE 01");
    expect(html).toContain("状態遷移を型にする");
    expect(html).toContain('aria-label="ページ内目次"');
    expect(html).toContain('<section id="mission"><h2>ミッション</h2></section>');
    expect(html).toContain('/modules/00-read-the-incident/');
    expect(html).toContain('/modules/02-boundary-and-ids/');
  });

  it("renders phase semantics, exact command text, expected result, and a copy island", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(CommandBlock, {
      props: {
        phase: "red",
        command: "pnpm test -- --runInBand",
        expected: "型エラーで失敗する",
      },
    });

    expect(html).toContain('class="command-block command-block--red"');
    expect(html).toContain('data-phase="red"');
    expect(html).toContain("失敗を確認する");
    expect(html).toContain("pnpm test -- --runInBand");
    expect(html).toContain("型エラーで失敗する");
    expect(html).toContain("client=\"idle\"");
  });
});
