import { describe, expect, it } from "vitest";
import { renderSessionPage, sessionCases } from "./session-test-helpers";

const chapterIds = {
  orientation: ["incident", "legacy", "review"],
  workshop: ["incident", "workflow", "review"],
  exercise: ["incident", "legacy", "red", "refactor", "review"],
  reference: ["incident", "legacy", "review"],
} as const;

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
});
