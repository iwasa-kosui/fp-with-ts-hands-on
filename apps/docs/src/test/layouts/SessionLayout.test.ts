import { markHTMLString } from "astro/runtime/server/index.js";
import { describe, expect, it } from "vitest";
import CommandBlock from "../../components/CommandBlock.astro";
import SessionLayout from "../../layouts/SessionLayout.astro";
import { sessions } from "../../sessions/catalog";
import { createAstroContainer } from "../render-astro";

const exerciseChapters = ["incident", "legacy", "refactor", "review"];
const shortChapters = ["incident", "legacy", "review"];
const referenceChapters = ["incident", "review"];
const workshopChapters = ["incident", "workflow", "review"];
const orientation = sessions.find(({ kind }) => kind === "orientation")!;
const workshop = sessions.find(({ kind }) => kind === "workshop")!;
const exercise = sessions.find(({ kind }) => kind === "exercise")!;
const reference = sessions.find(({ kind }) => kind === "reference")!;

describe("SessionLayout", () => {
  it.each([
    {
      session: orientation,
      expected: shortChapters,
      labels: ["現行業務と事故", "画面・保存・ログ", "レビューと持ち帰り"],
    },
    {
      session: workshop,
      expected: workshopChapters,
      labels: ["何が起きたか", "ワークフローを描く", "レビューと持ち帰り"],
    },
    {
      session: exercise,
      expected: exerciseChapters,
      labels: [
        "今回つくるもの",
        "コードを読み、失敗を再現する",
        "型で閉じる",
        "レビューと持ち帰り",
      ],
    },
    {
      session: reference,
      expected: referenceChapters,
      labels: ["5つの境界を確認する", "レビューと持ち帰り"],
    },
  ])("drives both TOCs from the $session.kind chapter definition", async ({ session, expected, labels }) => {
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
    expect(desktopLinks.map(({ textContent }) => textContent)).toEqual(labels);
    expect(mobileLinks.map(({ textContent }) => textContent)).toEqual(labels);
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

  it("shows only the animal icon and session summary in the hero summary", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(SessionLayout, {
      props: { session: workshop },
      slots: { default: "本文" },
    });
    const document = new DOMParser().parseFromString(html, "text/html");
    const summary = document.querySelector(".case-file__summary");

    expect(summary?.textContent?.replace(/\s+/g, "")).toBe(`🐈${workshop.summary}`);
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
