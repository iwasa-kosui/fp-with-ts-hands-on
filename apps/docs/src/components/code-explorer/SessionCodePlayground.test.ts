import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import { sessionWorkspaceFor } from "../../code-explorer/session-workspaces";
import { sessions } from "../../sessions/catalog";
import { createAstroContainer } from "./test-support/render-astro";
import SessionCodePlayground from "./SessionCodePlayground.astro";

const exerciseSessions = sessions.filter(({ kind }) => kind === "exercise");

describe("SessionCodePlayground", () => {
  for (const session of exerciseSessions) {
    it(`renders the ${session.slug} workspace`, async () => {
      const workspace = sessionWorkspaceFor(session.slug);
      const container = await createAstroContainer();
      const html = await container.renderToString(SessionCodePlayground, {
        props: { slug: session.slug },
      });
      const window = new Window();
      const document = new window.DOMParser().parseFromString(html, "text/html");

      expect(document.querySelector("h3#code-playground")?.textContent).toContain(
        "ブラウザで試す",
      );
      expect(
        document.querySelector('section[aria-labelledby="code-playground"]'),
      ).not.toBeNull();
      expect(
        document.querySelector(`[data-code-explorer="${session.slug}"]`),
      ).not.toBeNull();
      expect(document.body.textContent).toContain(workspace.initialFile);
      expect(document.body.textContent).toContain(workspace.description);
      expect(document.querySelector('astro-island[client="load"]')).not.toBeNull();
    });
  }
});
