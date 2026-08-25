import { describe, expect, it } from "vitest";
import { sessions } from "../../sessions/catalog";
import { renderSessionPage } from "./session-test-helpers";

const exercises = sessions.filter((session) => session.kind === "exercise");

const completionArtifacts = [
  "守る不変条件の1文",
  "依頼文",
  "型で守れなかった残り",
] as const;

const reviewPromises = [
  "見るのは差分であって人ではありません。発言は「この差分は」で始めます。",
  "良し悪しを判定しません。",
  "5回のレビューで、班員全員が少なくとも1回は選ばれるよう公平に配分します。選ばれることは評価ではありません。",
  "本人は弁明しません。読み上げるのは依頼文の1文だけです。",
  "TAは「よくできた実装」を選びません。選定基準を参加者にも開示します。",
] as const;

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
      expect(text).toContain(session.incident);
      expect(document.querySelectorAll("details.step-solution")).toHaveLength(
        session.steps.length,
      );

      for (const step of session.steps) expect(text).toContain(step.goal);
      for (const decision of session.decisions) {
        expect(text).toContain(decision.invariant);
        expect(text).toContain(decision.notByType);
      }
      for (const reference of session.finalReferences)
        expect(text).toContain(reference);
      for (const question of session.peerReview.questions) {
        expect(reviewText).toContain(question);
      }
      const reviewChecks = document.querySelectorAll(
        ".exercise-review-checklist > ol > li",
      );
      const scopedDiffCommand = `git diff --stat -- examples/${session.snapshot}`;
      expect(reviewChecks).toHaveLength(4);
      expect(reviewText.match(new RegExp(scopedDiffCommand, "g"))).toHaveLength(1);
      expect(reviewText).toContain("git status --short");
      expect(reviewText).not.toMatch(/git diff --stat(?! -- examples\/)/);
      expect(reviewText).toContain("前のセッションの未commit差分");
      expect(reviewText).toContain("reset、stash、commit");
      for (const artifact of completionArtifacts)
        expect(reviewText).toContain(artifact);
      expect(reviewText).toContain(
        "自分の業務コードで、今回と同種の問題が起きうる箇所はどこですか。",
      );
      expect(
        document.querySelectorAll(".session-code-playground"),
      ).toHaveLength(1);
    });
  }

  it("keeps the opening focused and returns to the full workflow in the review", async () => {
    for (const session of exercises) {
      const document = await renderSessionPage(session);
      const riskMaps = [
        ...document.querySelectorAll<HTMLElement>(".workflow-risk-map"),
      ];
      const opening = document.querySelector("#incident")!;
      const review = document.querySelector("#review")!;

      expect(riskMaps).toHaveLength(2);
      expect(riskMaps.map(({ dataset }) => dataset.placement)).toEqual([
        "opening",
        "review",
      ]);
      expect(new Set(riskMaps.map((map) => map.getAttribute("aria-label"))).size).toBe(2);
      expect(opening.querySelectorAll(".workflow-risk-map")).toHaveLength(1);
      expect(review.querySelectorAll(".workflow-risk-map")).toHaveLength(1);
      expect(riskMaps[0]?.querySelectorAll("[data-session-sequence]")).toHaveLength(1);
      expect(riskMaps[1]?.querySelectorAll("[data-session-sequence]")).toHaveLength(
        exercises.length,
      );
      expect(opening.textContent).not.toContain(session.incident);
      expect(review.textContent).toContain(session.incident);
      const openingFocus = riskMaps[0]?.querySelector<HTMLElement>(
        `[data-session-sequence="${session.sequence}"]`,
      );
      const reviewFocus = riskMaps[1]?.querySelector<HTMLElement>(
        `[data-session-sequence="${session.sequence}"]`,
      );

      expect(riskMaps.map(({ dataset }) => dataset.currentFocus)).toEqual([
        session.workflowFocus,
        session.workflowFocus,
      ]);
      expect(openingFocus?.getAttribute("aria-current")).toBe("step");
      expect(openingFocus?.textContent).toContain(session.summary);
      expect(reviewFocus?.getAttribute("aria-current")).toBe("step");
      expect(reviewFocus?.textContent).toContain(session.workflowRisks.resolvedFromPrevious);
      expect(reviewFocus?.textContent).toContain(session.workflowRisks.remainingForNext);
      const storyStages = [
        ...opening.querySelectorAll<HTMLElement>("[data-story-stage]"),
      ];
      expect(storyStages.map((stage) => stage.dataset.storyStage)).toEqual([
        "use-case",
        "pitfall",
        "goal",
      ]);
      expect(storyStages.map(({ tagName }) => tagName)).toEqual([
        "H3",
        "H3",
        "H3",
      ]);
    }
  });

  it("reproduces RED in the same chapter immediately after reading the distributed code", async () => {
    for (const session of exercises) {
      const document = await renderSessionPage(session);
      const legacy = document.querySelector("#legacy")!;

      expect(document.querySelector("#red")).toBeNull();
      expect(legacy.querySelector("[data-code-explorer]")).not.toBeNull();
      expect(legacy.querySelectorAll('[data-phase="red"]')).toHaveLength(1);
    }
  });

  it("shows the S2 pitfall as a concrete TypeScript example before the goal", async () => {
    const session = exercises.find(({ sequence }) => sequence === "02")!;
    const document = await renderSessionPage(session);
    const opening = document.querySelector("#incident")!;
    const pitfallHeading = opening.querySelector<HTMLElement>(
      '[data-story-stage="pitfall"]',
    )!;
    const goalHeading = opening.querySelector<HTMLElement>(
      '[data-story-stage="goal"]',
    )!;
    const example = opening.querySelector<HTMLElement>("[data-pitfall-code]");
    const exampleText = example?.textContent ?? "";

    expect(example?.tagName).toBe("FIGURE");
    expect(example?.querySelector("pre code")).not.toBeNull();
    expect(exampleText).toContain(
      "examples/session-02/src/domain/appointment/transitions.ts",
    );
    expect(exampleText).toContain("startExamination");
    expect(exampleText).toContain("appointment: Appointment");
    expect(exampleText).toContain("paidAppointment");
    expect(
      pitfallHeading.compareDocumentPosition(example!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      example!.compareDocumentPosition(goalHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it("explains how assertNever reports an unhandled S2 state", async () => {
    const session = exercises.find(({ sequence }) => sequence === "02")!;
    const document = await renderSessionPage(session);
    const refactor = document.querySelector("#refactor")!;
    const solutions = [...refactor.querySelectorAll("details.step-solution")];
    const note = refactor.querySelector<HTMLElement>("[data-exhaustiveness-note]");
    const noteText = note?.textContent ?? "";
    const example = note?.querySelector("pre code")?.textContent ?? "";

    expect(note?.querySelector("h4")?.textContent).toContain(
      "assertNeverによる網羅性チェックの仕組み",
    );
    expect(noteText).toContain("Appointment.kind");
    expect(noteText).toContain("never");
    expect(noteText).toContain("コンパイルエラー");
    expect(example).toContain('case "NoShow": の実装を忘れると');
    expect(example).toContain("return assertNever(appointment)");
    expect(
      solutions.at(-1)!.compareDocumentPosition(note!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it("uses catalog presentation metadata for answers and peer-review promises", async () => {
    const promisesSession = exercises.find(
      ({ peerReviewPromises }) => peerReviewPromises === "inline",
    )!;

    for (const session of exercises) {
      const document = await renderSessionPage(session);
      const heading = document.querySelector("[data-solution-heading]");
      const expectedHeading =
        session.solutionPresentation === "completed-file"
          ? "完成ファイルの解答例"
          : "ステップごとの解答";
      const promises = document.querySelector("#peer-review-promises");
      const promisesLink = document.querySelector<HTMLAnchorElement>(
        ".peer-review-panel a",
      );

      expect(heading?.textContent).toContain(expectedHeading);
      if (session.solutionPresentation === "completed-file") {
        expect(document.querySelector(".before-after")).not.toBeNull();
      } else {
        expect(document.querySelector(".before-after")).toBeNull();
      }
      expect(promises === null).toBe(session.peerReviewPromises !== "inline");
      expect(promisesLink?.getAttribute("href")).toBe(
        session.peerReviewPromises === "inline"
          ? "#peer-review-promises"
          : `/sessions/${promisesSession.slug}/#peer-review-promises`,
      );
    }
  });

  it("renders playgrounds on the four exercises only", async () => {
    for (const session of sessions) {
      const document = await renderSessionPage(session);
      expect(
        document.querySelectorAll(".session-code-playground"),
      ).toHaveLength(session.kind === "exercise" ? 1 : 0);
    }
  });

  it("introduces the canonical five review promises in S2 and links later exercises", async () => {
    const onboarding = await renderSessionPage(sessions[0]);
    const workshop = await renderSessionPage(sessions[1]);
    const promisesSession = exercises.find(
      ({ peerReviewPromises }) => peerReviewPromises === "inline",
    )!;
    const firstExercise = await renderSessionPage(promisesSession);

    for (const promise of reviewPromises) {
      expect(onboarding.body.textContent).not.toContain(promise);
      expect(workshop.body.textContent).not.toContain(promise);
      expect(firstExercise.body.textContent).toContain(promise);
    }
    for (const session of exercises.filter(
      ({ peerReviewPromises }) => peerReviewPromises === "reference",
    )) {
      const document = await renderSessionPage(session);
      expect(
        document.querySelector<HTMLAnchorElement>(
          'a[href="/sessions/02-state-transitions/#peer-review-promises"]',
        ),
      ).not.toBeNull();
      for (const promise of reviewPromises)
        expect(document.body.textContent).not.toContain(promise);
    }
  });

  it("uses the workflow map to trace five boundaries in Final", async () => {
    const finalSession = sessions.find(({ slug }) => slug === "final")!;
    const document = await renderSessionPage(finalSession);
    const text = document.body.textContent ?? "";
    const riskMaps = [
      ...document.querySelectorAll<HTMLElement>(".workflow-risk-map"),
    ];

    expect(riskMaps).toHaveLength(2);
    expect(riskMaps.map(({ dataset }) => dataset.placement)).toEqual([
      "opening",
      "review",
    ]);
    expect(new Set(riskMaps.map((map) => map.getAttribute("aria-label"))).size).toBe(2);
    expect(document.querySelectorAll("#legacy .workflow-risk-map")).toHaveLength(1);
    expect(document.querySelectorAll("#review .workflow-risk-map")).toHaveLength(1);
    expect(riskMaps[1]?.querySelector("ol")?.textContent).toBe(
      riskMaps[0]?.querySelector("ol")?.textContent,
    );
    expect(
      riskMaps.map((map) => map.querySelectorAll("[data-session-sequence]").length),
    ).toEqual([5, 5]);
    for (const boundary of [
      "1分目: 入力境界",
      "2分目: 業務上の失敗",
      "3分目: 出力イベント",
      "4分目: 副作用",
      "5分目: 例外境界",
    ]) {
      expect(text).toContain(boundary);
    }
    expect(text).toContain("src/useCase/startExaminationUseCase.ts");
    expect(text).toContain("src/adaptor/secondary/sqlite/store/appointmentEventStore.ts");
    expect(text).toContain("SQLite障害や破損データが業務 Result に入らず");
    expect(finalSession.finalReferences).toContain("examples/final/src/app.ts");
  });
});
