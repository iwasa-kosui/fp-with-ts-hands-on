import { describe, expect, it } from "vitest";
import type { CodeGuide } from "../../code-explorer/code-guide";
import { createAstroContainer } from "../../test/render-astro";
import SessionCodeOverview from "./SessionCodeOverview.astro";

const guides = [
  {
    id: "wide-appointment",
    title: "遷移元が広すぎる",
    currentDesign: "Appointment 全体を受け取っています。",
    futureRisk: "許可しない状態も呼び出せます。",
    path: "src/domain/appointment/transitions.ts",
    highlights: [{ startLineNumber: 18, endLineNumber: 24 }],
  },
] as const satisfies readonly CodeGuide[];

describe("SessionCodeOverview", () => {
  it("renders the supplied session guides as a read-only h3 overview", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(SessionCodeOverview, {
      props: { slug: "02-state-transitions", guides },
    });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("h3")?.textContent).toContain("配布コードの設計課題");
    expect(document.querySelector("h2")).toBeNull();
    expect(document.querySelector('[data-code-overview]')).not.toBeNull();
    expect(
      document.querySelector('[data-code-explorer="02-state-transitions"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain("遷移元が広すぎる");
    expect(document.querySelector('[data-action="run"]')).toBeNull();
    expect(document.querySelector('[data-action="reset"]')).toBeNull();
  });
});
