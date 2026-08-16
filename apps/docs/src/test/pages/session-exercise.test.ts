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
  "4回で班の全員が最低1回は当たるよう公平に配分します。選ばれることは評価ではありません。",
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

  it("connects every exercise to the shared workflow risk map and causal narrative", async () => {
    for (const session of exercises) {
      const document = await renderSessionPage(session);
      const riskMap = document.querySelector<HTMLElement>(".workflow-risk-map");
      const currentRisk = riskMap?.querySelector<HTMLElement>(
        `[data-session-sequence="${session.sequence}"]`,
      );

      expect(riskMap?.dataset.currentFocus).toBe(session.workflowFocus);
      expect(currentRisk?.getAttribute("aria-current")).toBe("step");
      expect(currentRisk?.textContent).toContain(session.workflowRisks.resolvedFromPrevious);
      expect(currentRisk?.textContent).toContain(session.workflowRisks.remainingForNext);
      expect(
        [...document.querySelectorAll<HTMLElement>("[data-causal-stage]")].map(
          (stage) => stage.dataset.causalStage,
        ),
      ).toEqual([
        "requirement",
        "current-risk",
        "design",
        "limitation",
        "next-question",
      ]);
    }
  });

  it("teaches business Result separately from the technical exception path", async () => {
    const businessFailureSession = exercises.find(
      ({ workflowFocus }) => workflowFocus === "expected failures",
    )!;
    const effectsSession = exercises.find(
      ({ workflowFocus }) => workflowFocus === "output event/side effects",
    )!;
    const businessFailureDocument = await renderSessionPage(businessFailureSession);
    const effectsDocument = await renderSessionPage(effectsSession);
    const businessFailureText = businessFailureDocument.body.textContent ?? "";
    const effectsText = effectsDocument.body.textContent ?? "";

    expect(businessFailureText).toContain("予期できる業務失敗");
    expect(businessFailureText).toContain("Result");
    expect(effectsText).toContain("業務 Result");
    expect(effectsText).toContain("技術的な例外");
    expect(effectsText).toContain("reject");
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

  it("pins the Final seven-aggregate tour to the composition root", async () => {
    const finalSession = sessions.find(({ slug }) => slug === "final")!;
    const document = await renderSessionPage(finalSession);
    const text = document.body.textContent ?? "";

    expect(text).toContain("1業務集約 → 7業務集約");
    expect(text).toContain("examples/final/src/app.ts");
    for (const aggregate of [
      "予約",
      "検査結果",
      "フォローアップ",
      "飼い主",
      "ペット",
      "セッション",
      "ユーザー",
    ]) {
      expect(text).toContain(aggregate);
    }
    expect(finalSession.finalReferences).toContain("examples/final/src/app.ts");
  });
});
