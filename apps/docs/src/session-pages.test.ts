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
  eventStormingScenario?: Readonly<{
    lanes: readonly Readonly<{ id: string; label: string }>[];
    events: readonly Readonly<{
      id: string;
      laneId: string;
      minute: number;
      actor?: string;
      command: string;
      aggregate: string;
    }>[];
    hotspots: readonly Readonly<{
      id: string;
      relatedEventIds: readonly string[];
    }>[];
  }>;
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
        title: "ビジネスイベントからワークフローを描く",
      },
      next: {
        href: "/sessions/03-semantic-identifiers/",
        title: "用途の異なる識別子を型で区別する",
      },
    },
  },
  "03-semantic-identifiers": {
    workspace: {
      slug: "03-semantic-identifiers",
      snapshot: "session-03",
      initialFile: "exercises/semantic-identifiers.test.ts",
      description:
        "識別子の用途と、それを使う予約の状態を開始 snapshot で確認します。",
      visibleFiles: [
        "exercises/semantic-identifiers.test.ts",
        "test/regression/state-modeling.test.ts",
        "src/domain/ids/examId.ts",
        "src/domain/ids/petId.ts",
        "src/domain/ids/ownerId.ts",
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
        title: "外部入力を境界で検証し個人情報を守る",
      },
    },
  },
  "04-boundaries-and-pii": {
    workspace: {
      slug: "04-boundaries-and-pii",
      snapshot: "session-04",
      initialFile: "exercises/boundary-and-pii.test.ts",
      description: "input の検証と PII の境界を開始 snapshot で確認します。",
      visibleFiles: [
        "exercises/boundary-and-pii.test.ts",
        "test/regression/semantic-identifiers.test.ts",
        "test/regression/state-modeling.test.ts",
        "src/domain/appointment/appointment.ts",
        "src/boundary/examResult.ts",
        "src/boundary/ownerContact.ts",
      ],
    },
    navigation: {
      previous: {
        href: "/sessions/03-semantic-identifiers/",
        title: "用途の異なる識別子を型で区別する",
      },
      next: {
        href: "/sessions/05-workflow-errors/",
        title: "失敗をワークフローの結果として扱う",
      },
    },
  },
  "05-workflow-errors": {
    workspace: {
      slug: "05-workflow-errors",
      snapshot: "session-05",
      initialFile: "exercises/result-errors.test.ts",
      description:
        "expected failures と Result の要求を開始 snapshot で確認します。",
      visibleFiles: [
        "exercises/result-errors.test.ts",
        "test/regression/boundary-and-ids.test.ts",
        "test/regression/state-modeling.test.ts",
        "src/boundary/examResult.ts",
        "src/boundary/ownerContact.ts",
        "src/domain/appointment/appointment.ts",
        "src/domain/appointment/transitions.ts",
        "src/domain/appointment/statusLabel.ts",
        "src/domain/ids/appointmentId.ts",
        "src/domain/ids/examId.ts",
        "src/domain/ids/ownerId.ts",
        "src/domain/ids/petId.ts",
        "src/domain/ids/veterinarianId.ts",
        "src/shared/sensitive.ts",
        "src/useCase/errors.ts",
        "src/useCase/startExamination.ts",
      ],
    },
    navigation: {
      previous: {
        href: "/sessions/04-boundaries-and-pii/",
        title: "外部入力を境界で検証し個人情報を守る",
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
        title: "失敗をワークフローの結果として扱う",
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
  "不変条件を型で守っているか、実行時の `if` で守っているかを判定し、型で守れなかった残りを記録する。",
  "守る不変条件の1文",
  "依頼文",
  "型で守れなかった残り",
  "自分の業務コードで、今回と同種の問題が起きうる箇所はどこですか。",
] as const;

const peerReviewPromises = [
  "人ではなく差分を見ます。「この差分は」で話し始め、優劣をつけません。",
  "本人は依頼文の1文だけを読み上げ、弁明しません。",
  "TAは選定基準を共有し、5回で班員全員を少なくとも1回選びます。選出は評価ではありません。",
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

    it(`${slug} renders overview guides separately from the playground`, () => {
      const codeExplorerTags =
        sourceFor(slug).match(/<CodeExplorer[\s\S]*?\/>/g) ?? [];

      expect(codeExplorerTags).toHaveLength(2);
      expect(
        codeExplorerTags.filter((tag) => tag.includes("guides={guides}")),
      ).toHaveLength(1);
      expect(
        codeExplorerTags.filter((tag) => !tag.includes("guides={guides}")),
      ).toHaveLength(1);
      for (const tag of codeExplorerTags) {
        expect(tag).toContain("workspace={workspace}");
        expect(tag).toContain("projectFiles={projectFiles}");
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

  it("S1 gives participants parallel work and an unresolved decision to discover", () => {
    const scenario = pageModules[
      "./pages/sessions/01-business-events-and-workflows.astro"
    ]?.eventStormingScenario;

    expect(scenario).toBeDefined();
    if (scenario === undefined) return;

    expect(scenario.lanes).toHaveLength(2);
    expect(new Set(scenario.events.map(({ laneId }) => laneId))).toEqual(
      new Set(scenario.lanes.map(({ id }) => id)),
    );
    expect(
      scenario.events.some((event, _index, events) =>
        events.some(
          (candidate) =>
            candidate.minute === event.minute &&
            candidate.laneId !== event.laneId,
        ),
      ),
    ).toBe(true);
    expect(scenario.events.every(({ command, aggregate }) =>
      command !== "" && aggregate !== ""
    )).toBe(true);
    expect(scenario.events.some(({ actor }) => actor === undefined)).toBe(true);
    expect(
      scenario.events.find(({ id }) => id === "mugi-examination-held")?.actor,
    ).toBeUndefined();
    expect(
      scenario.events.find(({ id }) => id === "sora-examination-started")
        ?.actor,
    ).toBe("獣医師");
    expect(scenario.hotspots).not.toHaveLength(0);

    const eventIds = new Set(scenario.events.map(({ id }) => id));
    for (const hotspot of scenario.hotspots) {
      expect(hotspot.relatedEventIds.length).toBeGreaterThanOrEqual(2);
      expect(
        hotspot.relatedEventIds.every((eventId) => eventIds.has(eventId)),
      ).toBe(true);
      expect(
        hotspot.relatedEventIds.some(
          (eventId) =>
            scenario.events.find((event) => event.id === eventId)?.actor ===
            undefined,
        ),
      ).toBe(true);
    }
  });

  it("S1 keeps commands scoped to one patient lane", () => {
    const scenario = pageModules[
      "./pages/sessions/01-business-events-and-workflows.astro"
    ]?.eventStormingScenario;

    expect(scenario).toBeDefined();
    if (scenario === undefined) return;

    for (const event of scenario.events) {
      const simultaneousEvents = scenario.events.filter(
        (candidate) =>
          candidate.minute === event.minute &&
          candidate.laneId !== event.laneId,
      );
      expect(
        simultaneousEvents.every(
          (candidate) => candidate.command !== event.command,
        ),
      ).toBe(true);
    }
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
