import { describe, expect, it } from "vitest";
import SessionCodeOverview from "./SessionCodeOverview.astro";
import { createAstroContainer } from "../../test/render-astro";

const guideTitles = [
  "状態を任意の文字列で表している",
  "状態固有の情報が optional field に広がっている",
  "用途の異なる ID がすべて string である",
  "予期可能な失敗を throw している",
  "個人情報を含む値をそのままログへ渡している",
] as const;

describe("SessionCodeOverview", () => {
  it("renders the five onboarding guides as a read-only code overview", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(SessionCodeOverview);
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("h2#design-overview")?.textContent).toBe(
      "先人のコードを眺める",
    );
    expect(document.querySelector('[data-code-overview]')).not.toBeNull();
    expect(
      document.querySelector('[data-code-explorer="00-onboarding"]'),
    ).not.toBeNull();
    expect(document.querySelector('astro-island[client="load"]')).not.toBeNull();
    expect(document.body.textContent).toContain("LegacyAppointment");
    expect(
      [...document.querySelectorAll("[data-code-guide]")].map(
        (button) => button.querySelector("span:last-child")?.textContent,
      ),
    ).toEqual(guideTitles);
    expect(document.querySelector('[data-action="run"]')).toBeNull();
    expect(document.querySelector('[data-action="reset"]')).toBeNull();
    expect(document.body.textContent).not.toContain("コードを実行");
    expect(document.body.textContent).not.toContain("リセット");
  });
});
