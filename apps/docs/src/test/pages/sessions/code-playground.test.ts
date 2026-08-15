import { describe, expect, it } from "vitest";
import StateModelingPage from "../../../pages/sessions/01-state-modeling.astro";
import BoundaryAndIdsPage from "../../../pages/sessions/02-boundary-and-ids.astro";
import ResultErrorsPage from "../../../pages/sessions/03-result-errors.astro";
import AgentReviewPage from "../../../pages/sessions/04-agent-review.astro";
import MiniIntegrationPage from "../../../pages/sessions/05-mini-integration.astro";
import FinalPage from "../../../pages/sessions/final.astro";
import { createAstroContainer } from "../../render-astro";

const parseStaticMarkup = (html: string): Document =>
  new DOMParser().parseFromString(
    html.replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""),
    "text/html",
  );

const pages = [
  {
    slug: "01-state-modeling",
    Page: StateModelingPage,
    initialFile: "exercises/state-modeling.test.ts",
  },
  {
    slug: "02-boundary-and-ids",
    Page: BoundaryAndIdsPage,
    initialFile: "exercises/boundary-and-ids.test.ts",
  },
  {
    slug: "03-result-errors",
    Page: ResultErrorsPage,
    initialFile: "exercises/result-errors.test.ts",
  },
  {
    slug: "04-agent-review",
    Page: AgentReviewPage,
    initialFile: "exercises/effects-and-events.test.ts",
  },
  {
    slug: "05-mini-integration",
    Page: MiniIntegrationPage,
    initialFile: "test/regression/effects-and-events.test.ts",
  },
  {
    slug: "final",
    Page: FinalPage,
    initialFile: "test/useCase/startExaminationUseCase.test.ts",
  },
] as const;

describe("session code playgrounds", () => {
  for (const { slug, Page, initialFile } of pages) {
    it(`renders ${slug}'s playground and table-of-contents entry`, async () => {
      const container = await createAstroContainer();
      const html = await container.renderToString(Page, { partial: false });
      const document = parseStaticMarkup(html);

      expect(
        document.querySelector("article h2#code-playground")?.textContent,
      ).toBe("ブラウザで試す");
      expect(
        document.querySelector(`[data-code-explorer="${slug}"]`),
      ).not.toBeNull();
      expect(document.body.textContent).toContain(initialFile);
      expect(
        document.querySelectorAll(
          'nav[aria-label="ページ内目次"] a[href="#code-playground"]',
        ),
      ).toHaveLength(2);
      expect(
        document.querySelectorAll('astro-island[client="load"]'),
      ).toHaveLength(1);
    });
  }
});
