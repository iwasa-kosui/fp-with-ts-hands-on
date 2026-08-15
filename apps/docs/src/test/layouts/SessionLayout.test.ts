import { markHTMLString } from "astro/runtime/server/index.js";
import { describe, expect, it } from "vitest";
import CommandBlock from "../../components/CommandBlock.astro";
import SessionLayout from "../../layouts/SessionLayout.astro";
import { sessions } from "../../sessions/catalog";
import { createAstroContainer } from "../render-astro";

const exerciseChapters = ["incident", "legacy", "red", "refactor", "review"];
const shortChapters = ["incident", "legacy", "review"];

describe("SessionLayout", () => {
  it.each([
    { session: sessions[0], expected: shortChapters },
    { session: sessions[1], expected: exerciseChapters },
    { session: sessions[5], expected: shortChapters },
  ])("drives both TOCs from the $session.kind chapter definition", async ({ session, expected }) => {
    const container = await createAstroContainer();
    const html = await container.renderToString(SessionLayout, {
      props: { session },
      slots: {
        default: markHTMLString(
          expected.map((id) => `<section id="${id}"><h2>${id}</h2></section>`).join(""),
        ),
      },
    });
    const document = new DOMParser().parseFromString(html, "text/html");
    const desktopLinks = [
      ...document.querySelectorAll<HTMLAnchorElement>(".case-file__toc--desktop a"),
    ];
    const mobileLinks = [
      ...document.querySelectorAll<HTMLAnchorElement>(".case-file__toc--mobile a"),
    ];

    expect(desktopLinks.map(({ hash }) => hash)).toEqual(expected.map((id) => `#${id}`));
    expect(mobileLinks.map(({ hash }) => hash)).toEqual(expected.map((id) => `#${id}`));
    for (const { hash } of desktopLinks) {
      expect(document.querySelectorAll(hash)).toHaveLength(1);
    }
    expect(document.querySelector("h1")?.textContent).toBe(session.title);
  });

  it("keeps the mobile table of contents initially closed", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(SessionLayout, {
      props: { session: sessions[1] },
      slots: { default: "本文" },
    });
    const document = new DOMParser().parseFromString(html, "text/html");
    const mobileToc = document.querySelector("details.case-file__toc--mobile");

    expect(mobileToc?.hasAttribute("open")).toBe(false);
    expect(mobileToc?.querySelector("summary")?.textContent).toContain("目次");
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
    expect(html).toContain('client="idle"');
  });
});
