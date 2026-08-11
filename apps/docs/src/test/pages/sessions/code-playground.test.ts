import { describe, expect, it } from "vitest";
import { sessionWorkspaceFor } from "../../../code-explorer/session-workspaces";
import { sessions } from "../../../sessions/catalog";
import { createAstroContainer } from "../../render-astro";

const pageModules = import.meta.glob<{ default: unknown }>(
  "../../../pages/sessions/*.astro",
  { eager: true },
);

const parseStaticMarkup = (html: string): Document =>
  new DOMParser().parseFromString(
    html.replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""),
    "text/html",
  );

describe("session code playgrounds", () => {
  for (const session of sessions) {
    it(`renders ${session.slug}'s playground and table-of-contents entry`, async () => {
      const key = `../../../pages/sessions/${session.slug}.astro`;
      const Page = pageModules[key]?.default;
      expect(Page, `missing page module: ${session.slug}`).toBeDefined();

      const container = await createAstroContainer();
      const html = await container.renderToString(Page as never, { partial: false });
      const document = parseStaticMarkup(html);
      const workspace = sessionWorkspaceFor(session.slug);

      expect(document.querySelector("article h2#code-playground")?.textContent).toBe(
        session.sequence === "Final" ? "参照実装を読む" : "ブラウザで試す",
      );
      expect(document.querySelector(`[data-code-explorer="${session.slug}"]`)).not.toBeNull();
      expect(document.body.textContent).toContain(
        session.sequence === "Final"
          ? "src/domain/appointment/appointment.ts"
          : workspace.initialFile,
      );
      expect(
        document.querySelectorAll(
          'nav[aria-label="ページ内目次"] a[href="#code-playground"]',
        ),
      ).toHaveLength(2);
      expect(document.querySelectorAll('astro-island[client="load"]')).toHaveLength(1);

      if (session.sequence !== "00" && session.sequence !== "Final") {
        for (const id of ["incident", "work", "technique", "verification", "reflection"]) {
          expect(
            document.querySelector(`article section#${id}`),
            `${session.slug} #${id}`,
          ).not.toBeNull();
        }
        expect(document.querySelector("article [data-actor]")).not.toBeNull();
        expect(document.querySelectorAll("#verification dt")).toHaveLength(3);
        expect(document.querySelector('a[rel="next"]')).not.toBeNull();
      }

      if (session.sequence === "Final") {
        expect(document.querySelector('[data-action="reset"]')).toBeNull();
        expect(document.querySelector('[data-action="run"]')).toBeNull();
      }
    });
  }
});
