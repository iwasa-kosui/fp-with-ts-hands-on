import { describe, expect, it } from "vitest";
import { sessions } from "../../sessions/catalog";
import { renderSessionPage, sessionCases } from "./session-test-helpers";

const chapterIds = {
  orientation: ["incident", "legacy", "review"],
  workshop: ["incident", "workflow", "review"],
  exercise: ["incident", "legacy", "red", "refactor", "review"],
  reference: ["incident", "legacy", "review"],
} as const;

const workflowFields = [
  "trigger",
  "input",
  "current state",
  "expected failures",
  "output event",
  "side effects",
] as const;

describe("session page structure", () => {
  it.each(sessionCases)("renders catalog chapters and both TOCs for $name", async ({ session }) => {
    const document = await renderSessionPage(session);
    const expectedIds = chapterIds[session.kind];
    const directSections = [
      ...document.querySelectorAll<HTMLElement>("article.case-file__content > section"),
    ];

    expect(document.querySelector("h1")?.textContent).toBe(session.title);
    expect(directSections.map(({ id }) => id)).toEqual(expectedIds);
    expect(document.querySelectorAll('nav[aria-label="ページ内目次"]')).toHaveLength(2);

    const ids = [...document.querySelectorAll<HTMLElement>("[id]")].map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const id of expectedIds) {
      expect(
        document.querySelectorAll(`nav[aria-label="ページ内目次"] a[href="#${id}"]`),
      ).toHaveLength(2);
      expect(document.querySelectorAll(`#${id}`)).toHaveLength(1);
      expect(document.querySelector(`#${id}`)?.firstElementChild?.tagName).toBe("H2");
    }
  });

  it("runs S1 as a non-code group workshop with blank and facilitator workflow cards", async () => {
    const session = sessions.find(({ kind }) => kind === "workshop")!;
    const document = await renderSessionPage(session);
    const text = document.body.textContent ?? "";
    const blankCard = document.querySelector('.workflow-card[data-variant="blank"]');
    const answerCard = document.querySelector('.workflow-card[data-variant="answer"]');

    expect(text).toContain("15分");
    expect(blankCard).not.toBeNull();
    expect(answerCard).not.toBeNull();
    expect(
      [...blankCard!.querySelectorAll<HTMLElement>("[data-workflow-field]")].map(
        (field) => field.dataset.workflowField,
      ),
    ).toEqual(workflowFields);
    expect(
      [...answerCard!.querySelectorAll<HTMLElement>("[data-workflow-field]")].map(
        (field) => field.dataset.workflowField,
      ),
    ).toEqual(workflowFields);
    expect(text).toContain("講師回答例");
    expect(text).toContain("ラボ結果の到着");
    expect(text).toContain("別のtrigger");
    expect(document.querySelector(".workflow-risk-map")).not.toBeNull();
    expect(document.querySelector("[data-code-explorer]")).toBeNull();
    expect(document.querySelector(".command-block")).toBeNull();
    expect(document.querySelector("details.step-solution")).toBeNull();
    expect(text).not.toContain("pnpm exercise:");
  });
});
