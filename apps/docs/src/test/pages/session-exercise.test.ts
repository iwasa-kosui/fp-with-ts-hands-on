import { describe, expect, it } from "vitest";
import { sessions } from "../../sessions/catalog";
import { renderSessionPage } from "./session-test-helpers";

const exercises = sessions.filter((session) => session.kind === "exercise");

describe("exercise session contract", () => {
  for (const session of exercises) {
    it(`renders every catalog value for ${session.slug}`, async () => {
      const document = await renderSessionPage(session);
      const text = document.body.textContent ?? "";
      const reviewText = document.querySelector("#review")?.textContent ?? "";
      const red = document.querySelectorAll('[data-phase="red"]');
      const green = document.querySelectorAll('[data-phase="green"]');

      expect(red).toHaveLength(1);
      expect(green).toHaveLength(1);
      expect(red[0]?.textContent).toContain(session.exerciseCommand);
      expect(green[0]?.textContent).toContain(session.exerciseCommand);
      expect(text).toContain(session.exerciseModule.dir);
      expect(document.querySelectorAll("details.step-solution")).toHaveLength(
        session.steps.length,
      );

      for (const step of session.steps) expect(text).toContain(step.goal);
      for (const decision of session.decisions) {
        expect(text).toContain(decision.invariant);
        expect(text).toContain(decision.notByType);
      }
      for (const reference of session.finalReferences) expect(text).toContain(reference);
      for (const question of session.peerReview.questions) {
        expect(reviewText).toContain(question);
      }
      expect(document.querySelectorAll(".session-code-playground")).toHaveLength(1);
    });
  }

  it("renders playgrounds on the four exercises only", async () => {
    for (const session of sessions) {
      const document = await renderSessionPage(session);
      expect(document.querySelectorAll(".session-code-playground")).toHaveLength(
        session.kind === "exercise" ? 1 : 0,
      );
    }
  });
});
