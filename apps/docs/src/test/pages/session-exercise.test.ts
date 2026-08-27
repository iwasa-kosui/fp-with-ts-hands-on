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
  "人ではなく差分を見ます。「この差分は」で話し始め、優劣をつけません。",
  "本人は依頼文の1文だけを読み上げ、弁明しません。",
  "TAは選定基準を共有し、5回で班員全員を少なくとも1回選びます。選出は評価ではありません。",
] as const;

const delegationDecisionsBySlug = {
  "02-state-transitions": [
    "どの状態からどの状態への遷移を許可するか",
    "各状態で必須にする情報は何か",
    "状態追加時の分岐漏れをどこで検出するか",
  ],
  "03-semantic-identifiers": [
    "どの識別子を別の用途として扱うか",
    "用途の区別をどの状態や関数まで伝えるか",
    "取り違えをコンパイルエラーとしてどう残すか",
  ],
  "04-boundaries-and-pii": [
    "外部入力を信頼済みの値へ変える境界はどこか",
    "連絡先を取り出してよい処理はどこか",
  ],
  "05-workflow-errors": [
    "何を予期できる業務上の失敗として扱うか",
    "呼び出し側が分岐に使う安定した情報は何か",
    "失敗後に実行してはいけない処理は何か",
  ],
  "06-effects-and-consistency": [
    "実行ごとに変わる値をいつ生成するか",
    "どの状態と記録を同時に保存するか",
    "保存障害をどの境界まで伝えるか",
  ],
} as const;

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
      }
      for (const question of session.peerReview.questions) {
        expect(reviewText).toContain(question);
      }
      const reviewChecks = document.querySelectorAll(
        ".exercise-review-checklist > ol > li",
      );
      const scopedDiffCommand = `git diff --stat -- examples/${session.snapshot}`;
      expect(reviewChecks).toHaveLength(3);
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

  it("keeps the opening story and limits the review to verification and peer review", async () => {
    for (const session of exercises) {
      const document = await renderSessionPage(session);
      const opening = document.querySelector("#incident")!;
      const review = document.querySelector("#review")!;

      expect(document.querySelectorAll(".workflow-risk-map")).toHaveLength(0);
      expect(opening.textContent).not.toContain(session.incident);
      expect(review.textContent).not.toContain(session.incident);
      expect(review.querySelectorAll(".decision-card")).toHaveLength(0);
      expect(review.querySelectorAll(".reference-list")).toHaveLength(0);
      expect(review.querySelector(".exercise-review-checklist")).not.toBeNull();
      expect(review.querySelector(".peer-review-panel")).not.toBeNull();
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

  it("turns each exercise brief into a practical prompt without deciding the design for the participant", async () => {
    const renderedPrompts = new Set<string>();

    for (const session of exercises) {
      const document = await renderSessionPage(session);
      const prompt = document.querySelector(".delegation-prompt pre code")
        ?.textContent ?? "";

      expect(prompt).toContain("業務背景:");
      expect(prompt).toContain(session.incident);
      expect(prompt).toContain("守る不変条件: [");
      expect(prompt).toContain("着手前に判断すること:");
      for (const decision of delegationDecisionsBySlug[session.slug]) {
        expect(prompt).toContain(`${decision}: [`);
      }
      expect(prompt).toContain("受け入れ条件:");
      for (const step of session.steps) expect(prompt).toContain(step.goal);
      expect(prompt).toContain(session.exerciseModule.dir);
      expect(prompt).toContain(session.exerciseCommand);
      expect(prompt).toContain("変更したファイルと判断理由");
      expect(prompt).toContain("型だけでは守れず、テストまたはレビューに残した点");
      renderedPrompts.add(prompt);
    }

    expect(renderedPrompts.size).toBe(exercises.length);
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

  it("places the S2 exhaustiveness example in teaching before the exercise", async () => {
    const session = exercises.find(({ sequence }) => sequence === "02")!;
    const document = await renderSessionPage(session);
    const teach = document.querySelector("#teach")!;
    const refactor = document.querySelector("#refactor")!;
    const example = teach.querySelector("[data-teaching-example] pre code")
      ?.textContent ?? "";

    expect(example).toContain('case "NoShow": の実装を忘れると');
    expect(example).toContain("return assertNever(appointment)");
    expect(
      teach.compareDocumentPosition(refactor) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(refactor.querySelector("[data-exhaustiveness-note]")).toBeNull();
  });

  it("contrasts an untagged object Union with S2 discriminant narrowing", async () => {
    const session = exercises.find(({ sequence }) => sequence === "02")!;
    const document = await renderSessionPage(session);
    const firstTopic = document.querySelector("#teach .teaching-topic")!;
    const topicText = firstTopic.textContent ?? "";
    const examples = [...firstTopic.querySelectorAll("pre code")].map(
      (code) => code.textContent ?? "",
    );

    expect(topicText).toContain("判別フィールドを持たないオブジェクトのUnion");
    expect(topicText).toContain("共通のkind");
    expect(examples[0]).toContain('"examinationStartedAt" in appointment');
    expect(examples[1]).toContain("switch (appointment.kind)");
    expect(examples.join("\n")).not.toContain("type AppointmentKind");
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

  it("introduces the review promises in S2 and links later exercises", async () => {
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

  it("traces five boundaries in Final without repeating the workflow map", async () => {
    const finalSession = sessions.find(({ slug }) => slug === "final")!;
    const document = await renderSessionPage(finalSession);
    const text = document.body.textContent ?? "";

    expect(document.querySelectorAll(".workflow-risk-map")).toHaveLength(0);
    expect(document.querySelector("#legacy")).toBeNull();
    expect(document.querySelector('a[href="#legacy"]')).toBeNull();
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
