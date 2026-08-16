import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import PeerReviewPanel from "../../components/PeerReviewPanel.astro";
import StepSolution from "../../components/StepSolution.astro";
import { sessionPath, sessions } from "../../sessions/catalog";
import { createAstroContainer } from "../render-astro";

const repoRoot = resolve(process.cwd(), "../..");
const exercises = sessions.filter((session) => session.kind === "exercise");
const promisesSession = exercises.find(
  ({ peerReviewPromises }) => peerReviewPromises === "inline",
);
const completedFileSession = exercises.find(
  ({ solutionPresentation }) => solutionPresentation === "completed-file",
);
const referencePromisesSession = exercises.find(
  ({ peerReviewPromises }) => peerReviewPromises === "reference",
);
if (
  promisesSession === undefined ||
  completedFileSession === undefined ||
  referencePromisesSession === undefined
) {
  throw new Error("Exercise presentation metadata is incomplete");
}
const firstStep = promisesSession.steps[0];
const completedFileStep = completedFileSession.steps[0];
if (firstStep === undefined || completedFileStep === undefined) {
  throw new Error("Exercise steps are missing");
}

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
      document.querySelector("details.step-solution")?.getAttribute("data-presentation"),
    ).toBe("excerpt");
    expect(document.querySelector(".step-solution__completed-file-note")).toBeNull();
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

  it("labels the completed-file fallback as including later steps", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(StepSolution, {
      props: { step: completedFileStep },
    });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(
      [...document.querySelectorAll(".step-solution__snippet > h4 > code")].map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(completedFileStep.solutions.map(({ path }) => path));
    expect(
      document.querySelector("details.step-solution")?.getAttribute("data-presentation"),
    ).toBe("completed-file");
    expect(
      document.querySelector(".step-solution__completed-file-note")?.textContent,
    ).toContain(
      "この完成例は後続stepを含む。表示された全target fileを反映後、同じexerciseをGREENにする",
    );

    const firstSolution = completedFileStep.solutions[0];
    const source = await readFile(resolve(repoRoot, firstSolution.path), "utf8");
    expect(
      document.querySelector("details.step-solution pre code")?.textContent,
    ).toBe(source.endsWith("\n") ? source.slice(0, -1) : source);
  });
});

describe("PeerReviewPanel", () => {
  it("renders the duration, fallback headcount, three questions, and local promises link", async () => {
    const container = await createAstroContainer();
    const peerReview = promisesSession.peerReview;
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

  it("links later sessions back to the first peer-review promises", async () => {
    const container = await createAstroContainer();
    const promisesHref = `${sessionPath(promisesSession)}#peer-review-promises`;
    const html = await container.renderToString(PeerReviewPanel, {
      props: {
        peerReview: referencePromisesSession.peerReview,
        promisesHref,
      },
    });

    expect(html).toContain(promisesHref);
  });
});
