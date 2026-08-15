import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import PeerReviewPanel from "../../components/PeerReviewPanel.astro";
import StepSolution from "../../components/StepSolution.astro";
import { sessions } from "../../sessions/catalog";
import { createAstroContainer } from "../render-astro";

const repoRoot = resolve(process.cwd(), "../..");
const firstStep = sessions[1].steps[0];

describe("StepSolution", () => {
  it("renders the exact source slice and goal inside details", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(StepSolution, {
      props: { step: firstStep },
    });
    const document = new DOMParser().parseFromString(html, "text/html");
    const solution = firstStep.solutions[0];
    const source = await readFile(resolve(repoRoot, solution.path), "utf8");
    const [start, end] = solution.lines;
    const expectedSlice = source
      .split("\n")
      .slice(start - 1, end)
      .join("\n");

    expect(
      document.querySelector("details.step-solution summary")?.textContent,
    ).toContain(firstStep.goal);
    expect(
      document.querySelector("details.step-solution h4 code")?.textContent,
    ).toBe(solution.path);
    expect(
      document.querySelector("details.step-solution pre code")?.textContent,
    ).toBe(expectedSlice);
  });

  it.each([
    { lines: [0, 1] as const, message: "1以上" },
    { lines: [4, 3] as const, message: "開始行" },
    { lines: [1, 999] as const, message: "範囲外" },
    { lines: [13, 13] as const, message: "空" },
  ])(
    "rejects an invalid source slice: $message",
    async ({ lines, message }) => {
      const container = await createAstroContainer();
      await expect(
        container.renderToString(StepSolution, {
          props: {
            step: {
              ...firstStep,
              solutions: [{ ...firstStep.solutions[0], lines }],
            },
          },
        }),
      ).rejects.toThrow(message);
    },
  );

  it("renders every solution snippet in declared order with an explicit path", async () => {
    const step = sessions[4].steps.find(
      ({ id }) => id === "s4-inject-context",
    )!;
    const container = await createAstroContainer();
    const html = await container.renderToString(StepSolution, {
      props: { step },
    });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(
      [...document.querySelectorAll(".step-solution__snippet > h4 > code")].map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(step.solutions.map(({ path }) => path));
  });
});

describe("PeerReviewPanel", () => {
  it("renders the duration, fallback headcount, three questions, and local promises link", async () => {
    const container = await createAstroContainer();
    const peerReview = sessions[1].peerReview;
    const html = await container.renderToString(PeerReviewPanel, {
      props: { peerReview, promisesHref: "#peer-review-promises" },
    });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("h3")?.textContent).toContain("7分・1〜2名");
    expect(
      [...document.querySelectorAll("ol li")].map(({ textContent }) =>
        textContent?.trim(),
      ),
    ).toEqual([...peerReview.questions]);
    expect(document.querySelector("a")?.getAttribute("href")).toBe(
      "#peer-review-promises",
    );
  });

  it("links later sessions back to the S1 promises", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(PeerReviewPanel, {
      props: {
        peerReview: sessions[2].peerReview,
        promisesHref: "/sessions/01-state-modeling/#peer-review-promises",
      },
    });

    expect(html).toContain("/sessions/01-state-modeling/#peer-review-promises");
  });
});
