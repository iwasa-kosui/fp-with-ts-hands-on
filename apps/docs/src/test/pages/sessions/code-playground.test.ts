import { describe, expect, it } from "vitest";
import { sessions } from "../../../sessions/catalog";
import { sessionWorkspaceFor } from "../../../code-explorer/session-workspaces";
import { renderSessionPage } from "../session-test-helpers";

describe("session code playgrounds", () => {
  for (const session of sessions) {
    it(`${session.slug} follows its catalog playground contract`, async () => {
      const document = await renderSessionPage(session);
      const playgrounds = document.querySelectorAll(".session-code-playground");

      expect(playgrounds).toHaveLength(session.kind === "exercise" ? 1 : 0);
      if (session.kind === "exercise") {
        const workspace = sessionWorkspaceFor(session.slug);
        expect(
          document.querySelector(`[data-code-explorer="${session.slug}"]`),
        ).not.toBeNull();
        expect(document.body.textContent).toContain(workspace.initialFile);
      }
    });
  }
});
