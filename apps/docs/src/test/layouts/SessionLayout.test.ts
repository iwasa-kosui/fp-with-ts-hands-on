import { markHTMLString } from "astro/runtime/server/index.js";
import { describe, expect, it } from "vitest";
import CommandBlock from "../../components/CommandBlock.astro";
import SessionLayout from "../../layouts/SessionLayout.astro";
import { sessions } from "../../sessions/catalog";
import { createAstroContainer } from "../render-astro";

describe("SessionLayout", () => {
  it("keeps the mobile table of contents initially closed", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(SessionLayout, {
      props: { session: sessions[2] },
      slots: { toc: "ミッション", default: "本文" },
    });
    const document = new DOMParser().parseFromString(html, "text/html");
    const mobileToc = document.querySelector("details.case-file__toc--mobile");
    const desktopNavigation = document.querySelector(".case-file__toc--desktop nav");

    expect(mobileToc).not.toBeNull();
    expect(mobileToc?.hasAttribute("open")).toBe(false);
    expect(mobileToc?.querySelector("summary")?.textContent).toContain("目次");
    expect(mobileToc?.querySelector("nav")?.textContent).toContain("ミッション");
    expect(desktopNavigation?.textContent).toContain("ミッション");
  });

  it("renders the case file hero, authored toc, body, and session navigation", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(SessionLayout, {
      props: { session: sessions[2] },
      slots: {
        toc: markHTMLString('<ol><li><a href="#mission">ミッション</a></li></ol>'),
        default: markHTMLString('<section id="mission"><h2>ミッション</h2></section>'),
      },
    });

    expect(html).toContain("SESSION 01");
    expect(html).toContain("状態遷移を型にする");
    expect(html).toContain('aria-label="ページ内目次"');
    expect(html).toContain('<section id="mission"><h2>ミッション</h2></section>');
    expect(html).toContain('/sessions/00-read-the-incident/');
    expect(html).toContain('/sessions/02-boundary-and-ids/');
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
