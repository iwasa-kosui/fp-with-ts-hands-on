import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { projectFilesForSnapshot } from "./code-explorer/project-files";
import type { SessionWorkspace } from "./code-explorer/types";
import type { SessionNavigation, SessionSummary } from "./sessions/types";

type PageModule = Readonly<{
  session?: SessionSummary;
  workspace?: SessionWorkspace;
  navigation?: SessionNavigation;
  promisesHref?: string;
}>;

const pageModules = import.meta.glob<PageModule>([
  "./pages/sessions/*.astro",
  "!./pages/sessions/index.astro",
], {
  eager: true,
});
const pageSources = import.meta.glob<string>([
  "./pages/sessions/*.astro",
  "!./pages/sessions/index.astro",
], {
  eager: true,
  query: "?raw",
  import: "default",
});
const catalogModules = import.meta.glob("./sessions/catalog.ts", {
  eager: true,
});

const docsRoot = process.cwd();
const currentTest = join(docsRoot, "src", "session-pages.test.ts");
const sourceRoots = ["src", "e2e", "scripts"] as const;
const sourceExtensions = new Set([".ts", ".tsx", ".astro", ".mjs"]);

const collectSourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collectSourceFiles(path);
      return entry.isFile() && sourceExtensions.has(extname(entry.name))
        ? [path]
        : [];
    }),
  );
  return nestedFiles.flat();
};

const exerciseSlugs = [
  "02-state-transitions",
  "03-semantic-identifiers",
  "04-boundaries-and-pii",
  "05-workflow-errors",
  "06-effects-and-consistency",
] as const;

type ExerciseSlug = (typeof exerciseSlugs)[number];

const exerciseContracts = {
  "02-state-transitions": {
    workspace: {
      slug: "02-state-transitions",
      snapshot: "session-02",
      initialFile: "exercises/state-modeling.test.ts",
      description:
        "current state の要求と作成対象を開始 snapshot で確認します。",
      visibleFiles: [
        "exercises/state-modeling.test.ts",
        "test/transitions.test.ts",
        "test/setup.test.ts",
        "src/domain/appointment/appointment.ts",
        "src/domain/appointment/transitions.ts",
        "src/domain/appointment/statusLabel.ts",
      ],
    },
    navigation: {
      previous: {
        href: "/sessions/01-business-events-and-workflows/",
        title: "EventStormingとROPで予約キャンセルを設計する",
      },
      next: {
        href: "/sessions/03-semantic-identifiers/",
        title: "診察開始の識別子を型で区別する",
      },
    },
  },
  "03-semantic-identifiers": {
    workspace: {
      slug: "03-semantic-identifiers",
      snapshot: "session-03",
      initialFile: "exercises/semantic-identifiers.test.ts",
      description:
        "診察開始で使う予約IDと獣医師IDを、開始snapshotで確認します。",
      visibleFiles: [
        "exercises/semantic-identifiers.test.ts",
        "test/regression/state-modeling.test.ts",
        "src/domain/appointment/appointmentId.ts",
        "src/domain/appointment/veterinarianId.ts",
        "src/domain/appointment/appointment.ts",
        "src/domain/appointment/transitions.ts",
        "src/domain/domain.test-types.ts",
      ],
    },
    navigation: {
      previous: {
        href: "/sessions/02-state-transitions/",
        title: "予約の状態と遷移をモデル化する",
      },
      next: {
        href: "/sessions/04-boundaries-and-pii/",
        title: "診察開始の入力を境界で検証する",
      },
    },
  },
  "04-boundaries-and-pii": {
    workspace: {
      slug: "04-boundaries-and-pii",
      snapshot: "session-04",
      initialFile: "exercises/start-examination-input.test.ts",
      description: "HTTP入力を診察開始の型付き入力へ変換する境界を確認します。",
      visibleFiles: [
        "exercises/start-examination-input.test.ts",
        "test/regression/semantic-identifiers.test.ts",
        "test/regression/state-modeling.test.ts",
        "src/domain/appointment/appointmentId.ts",
        "src/domain/appointment/veterinarianId.ts",
        "src/boundary/startExaminationInput.ts",
        "src/shared/schemaResult.ts",
        "src/web/routes.ts",
      ],
    },
    navigation: {
      previous: {
        href: "/sessions/03-semantic-identifiers/",
        title: "診察開始の識別子を型で区別する",
      },
      next: {
        href: "/sessions/05-workflow-errors/",
        title: "失敗をユースケースの結果として扱う",
      },
    },
  },
  "05-workflow-errors": {
    workspace: {
      slug: "05-workflow-errors",
      snapshot: "session-05",
      initialFile: "exercises/result-errors.test.ts",
      description:
        "例外の種類が型に現れず、Web側にcatch漏れがある開始 snapshot を確認します。",
      visibleFiles: [
        "exercises/result-errors.test.ts",
        "test/regression/boundary-and-ids.test.ts",
        "test/regression/state-modeling.test.ts",
        "src/boundary/examResult.ts",
        "src/boundary/ownerContact.ts",
        "src/domain/appointment/appointment.ts",
        "src/domain/appointment/transitions.ts",
        "src/domain/appointment/statusLabel.ts",
        "src/domain/appointment/appointmentId.ts",
        "src/domain/examResult/examId.ts",
        "src/domain/owner/ownerId.ts",
        "src/domain/pet/petId.ts",
        "src/domain/appointment/veterinarianId.ts",
        "src/shared/sensitive.ts",
        "src/useCase/errors.ts",
        "src/useCase/startExamination.ts",
        "src/web/routes.ts",
      ],
    },
    navigation: {
      previous: {
        href: "/sessions/04-boundaries-and-pii/",
        title: "診察開始の入力を境界で検証する",
      },
      next: {
        href: "/sessions/06-effects-and-consistency/",
        title: "副作用と整合性境界を設計する",
      },
    },
  },
  "06-effects-and-consistency": {
    workspace: {
      slug: "06-effects-and-consistency",
      snapshot: "session-06",
      initialFile: "exercises/effects-and-events.test.ts",
      description:
        "output event と side effects の要求を開始 snapshot で確認します。",
      visibleFiles: [
        "exercises/effects-and-events.test.ts",
        "test/regression/result-errors.test.ts",
        "src/domain/aggregate/clock.ts",
        "src/domain/aggregate/eventContext.ts",
        "src/domain/aggregate/eventId.ts",
        "src/domain/aggregate/eventIdGenerator.ts",
        "src/domain/appointment/examinationStarted.ts",
        "src/useCase/dependencies.ts",
        "src/useCase/errors.ts",
        "src/useCase/startExamination.ts",
        "src/shared/schemaResult.ts",
        "src/shared/sensitive.ts",
      ],
    },
    navigation: {
      previous: {
        href: "/sessions/05-workflow-errors/",
        title: "失敗をユースケースの結果として扱う",
      },
      next: {
        href: "/sessions/final/",
        title: "参照実装で境界をたどる",
      },
    },
  },
} as const satisfies Readonly<
  Record<
    ExerciseSlug,
    Readonly<{ workspace: SessionWorkspace; navigation: SessionNavigation }>
  >
>;

const forbiddenExerciseDependencies = [
  "ExerciseSessionContent",
  "SessionLayout",
  "ExerciseReviewChecklist",
  "PeerReviewPanel",
  "PeerReviewPromises",
  "StepSolution",
  "SessionCodeOverview",
  "SessionCodePlayground",
] as const;

const reviewText = [
  "`as` によるキャストが入っていないか全文検索して確認する。",
  "`git status --short` で想定外の path がないか確認する。",
  "型検査では確認できないことを、テストまたは実行時に確認して記録する。",
  "Agentへの依頼文",
  "型検査では確認できず、テストまたは実行時に確認すること",
  "自分の業務コードで、今回と同種の問題が起きうる箇所はどこですか。",
] as const;

const reviewPromptFor = {
  "02-state-transitions": "起きてはいけない状態遷移",
  "03-semantic-identifiers": "取り違えてはいけない値",
  "04-boundaries-and-pii": "境界で拒否する入力",
  "05-workflow-errors": "失敗後に実行してはいけない処理",
  "06-effects-and-consistency": "一緒に記録する必要がある値",
} as const satisfies Record<ExerciseSlug, string>;

const peerReviewPromises = [
  "人ではなく差分を見ます。「この差分は」で話し始め、優劣をつけません。",
  "本人はAgentへの依頼文だけを読み上げ、弁明しません。",
  "TAは、同じ課題に対して設計判断が異なる差分を選びます。完成度や技能による選出ではありません。",
  "5回で班員全員を少なくとも1回選びます。",
] as const;

const moduleFor = (slug: ExerciseSlug): PageModule =>
  pageModules[`./pages/sessions/${slug}.astro`] ?? {};

const sourceFor = (slug: ExerciseSlug): string =>
  pageSources[`./pages/sessions/${slug}.astro`] ?? "";

describe("session pages", () => {
  it("has no central session catalog module", () => {
    expect(catalogModules).toEqual({});
  });

  it("has no central session catalog references anywhere in docs sources", async () => {
    const files = (
      await Promise.all(
        sourceRoots.map((directory) =>
          collectSourceFiles(join(docsRoot, directory)),
        ),
      )
    ).flat();
    const references: string[] = [];

    for (const path of files) {
      if (path === currentTest) continue;
      const source = await readFile(path, "utf8");
      if (source.includes("sessions/catalog")) {
        references.push(relative(docsRoot, path));
      }
    }

    expect(references).toEqual([]);
  });

  it("keeps each session metadata object with its Astro page", () => {
    const sessions = Object.values(pageModules).map(({ session }) => session);

    expect(sessions).toHaveLength(8);
    expect(sessions.every((session) => session !== undefined)).toBe(true);
  });

  for (const slug of [
    "00-system-handover",
    "01-business-events-and-workflows",
    "final",
  ]) {
    it(`${slug} owns its page chrome`, () => {
      expect(pageSources[`./pages/sessions/${slug}.astro`]).not.toContain(
        "SessionLayout",
      );
    });
  }

  for (const slug of exerciseSlugs) {
    it(`${slug} owns exercise content and navigation`, () => {
      const source = sourceFor(slug);
      const pageModule = moduleFor(slug);
      const contract = exerciseContracts[slug];

      expect(source).not.toMatch(
        /from\s+["']\.\.\/\.\.\/sessions\/catalog["']/,
      );
      for (const dependency of forbiddenExerciseDependencies) {
        expect(source).not.toContain(dependency);
      }
      expect(pageModule.navigation).toEqual(contract.navigation);
      for (const text of reviewText) expect(source).toContain(text);
      expect(source).toContain(reviewPromptFor[slug]);
      expect(source).toContain(
        `\`git diff --stat -- examples/${contract.workspace.snapshot}\``,
      );
    });

    it(`${slug} exports the exact usable workspace`, () => {
      const pageModule = moduleFor(slug);
      const contract = exerciseContracts[slug];
      const { session, workspace } = pageModule;

      expect(workspace).toEqual(contract.workspace);
      expect(session?.kind).toBe("exercise");
      if (workspace === undefined || session?.kind !== "exercise") return;

      expect(workspace.slug).toBe(session.slug);
      expect(workspace.snapshot).toBe(session.snapshot);
      expect(workspace.visibleFiles).toContain(workspace.initialFile);
      expect(new Set(workspace.visibleFiles).size).toBe(
        workspace.visibleFiles.length,
      );

      const projectFiles = projectFilesForSnapshot(session.snapshot);
      for (const visibleFile of workspace.visibleFiles) {
        expect(projectFiles[visibleFile], `${slug}: ${visibleFile}`).toEqual(
          expect.any(String),
        );
      }
      for (const step of session.steps) {
        for (const target of step.targets) {
          const prefix = `examples/${session.snapshot}/`;
          expect(target.startsWith(prefix), target).toBe(true);
          expect(workspace.visibleFiles).toContain(target.slice(prefix.length));
        }
      }
    });

  }

  for (const slug of exerciseSlugs.slice(1)) {
    it(`${slug} preserves the hero avatar whitespace emitted by S2`, () => {
      expect(sourceFor(slug)).toContain(
        `<p class="case-file__summary">\n          <span aria-hidden="true">{session.animal.avatar}</span>\n          {session.summary}\n        </p>`,
      );
    });
  }

  it("S2 owns the inline peer-review promises", () => {
    const source = sourceFor("02-state-transitions");

    expect(moduleFor("02-state-transitions").promisesHref).toBe(
      "#peer-review-promises",
    );
    expect(source).toContain('id="peer-review-promises"');
    for (const promise of peerReviewPromises) expect(source).toContain(promise);
  });

  for (const slug of exerciseSlugs.slice(1)) {
    it(`${slug} owns the S2 peer-review promises href`, () => {
      expect(moduleFor(slug).promisesHref).toBe(
        "/sessions/02-state-transitions/#peer-review-promises",
      );
      expect(sourceFor(slug)).not.toContain('id="peer-review-promises"');
    });
  }

  it("S6 owns the completed-file solution and failure-boundary contract", () => {
    const source = sourceFor("06-effects-and-consistency");
    const session = moduleFor("06-effects-and-consistency").session;

    expect(session?.solutionPresentation).toBe("completed-file");
    expect(
      session?.steps.every((step) =>
        step.solutions.every(
          ({ presentation }) => presentation === "completed-file",
        ),
      ),
    ).toBe(true);
    expect(source).toContain("data-presentation={presentation}");
    expect(source).toContain('class="step-solution__completed-file-note"');
    expect(source).toContain(
      'class="failure-boundary" aria-label="業務エラーとインフラ例外の区別"',
    );
    expect(source).toContain("2つの失敗経路を見分ける");
  });
});
