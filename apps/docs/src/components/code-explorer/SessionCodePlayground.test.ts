import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import SessionCodePlayground from "./SessionCodePlayground.astro";
import { createAstroContainer } from "../../test/render-astro";

const cases = [
  {
    slug: "01-invariants",
    initialFile: "exercises/state-modeling.test.ts",
    description: "状態別の要求と作成対象を開始 snapshot で確認します。",
  },
] as const;

describe("SessionCodePlayground", () => {
  for (const example of cases) {
    it(`renders the ${example.slug} workspace`, async () => {
      const container = await createAstroContainer();
      const html = await container.renderToString(SessionCodePlayground, {
        props: { slug: example.slug },
      });
      const window = new Window();
      const document = new window.DOMParser().parseFromString(html, "text/html");

      expect(document.querySelector("h2#code-playground")?.textContent).toContain(
        "ブラウザで試す",
      );
      expect(document.querySelector("section[aria-labelledby=\"code-playground\"]")).not.toBeNull();
      expect(document.querySelector(`[data-code-explorer=\"${example.slug}\"]`)).not.toBeNull();
      expect(document.body.textContent).toContain(example.initialFile);
      expect(document.body.textContent).toContain(example.description);
      expect(document.querySelector('astro-island[client="load"]')).not.toBeNull();
    });
  }

  it("renders Final as a read-only source tour without mutable controls", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(SessionCodePlayground, {
      props: { slug: "final" },
    });
    const window = new Window();
    const document = new window.DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("h2#code-playground")?.textContent).toContain(
      "参照実装を読む",
    );
    expect(document.body.textContent).toContain("読み取り専用の参照実装を読みます");
    expect(document.body.textContent).not.toContain("ブラウザ内で編集して実行できます");
    expect(document.querySelector('[data-action="reset"]')).toBeNull();
    expect(document.querySelector('[data-action="run"]')).toBeNull();
    expect(html).toContain("final-reference-route");
  });
});
