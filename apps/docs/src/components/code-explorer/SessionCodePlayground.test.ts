import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import SessionCodePlayground from "./SessionCodePlayground.astro";
import { createAstroContainer } from "../../test/render-astro";

const cases = [
  {
    slug: "01-state-modeling",
    initialFile: "exercises/state-modeling.test.ts",
    description: "状態別の要求と作成対象を開始 snapshot で確認します。",
  },
  {
    slug: "final",
    initialFile: "test/follow-up.test.ts",
    description: "全セッションを統合した完成 snapshot を編集して実行します。",
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
});
