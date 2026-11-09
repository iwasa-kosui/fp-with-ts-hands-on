import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { projectFilesForSnapshot } from "./code-explorer/project-files";
import type { SessionWorkspace } from "./code-explorer/types";
import { splitSessions } from "./sessions/pages/split-sessions.fixture";
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
const astroSources = import.meta.glob<string>([
  "./pages/sessions/*.astro",
  "!./pages/sessions/index.astro",
], {
  eager: true,
  query: "?raw",
  import: "default",
});
const proseSources = import.meta.glob<string>("./sessions/prose/*.mdx", {
  eager: true,
  query: "?raw",
  import: "default",
});
const pageSources = Object.fromEntries(
  Object.entries(astroSources).map(([path, source]) => {
    const slug = path.replace(/^.*\//, "").replace(/\.astro$/, "");
    return [path, `${source}\n${proseSources[`./sessions/prose/${slug}.mdx`] ?? ""}`];
  }),
);
const splitProseSources = import.meta.glob<string>(
  "./sessions/prose/*/*.mdx",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
);
const splitRouteSources = import.meta.glob<string>(
  "./pages/sessions/*/*.astro",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
);
const catalogModules = import.meta.glob("./sessions/catalog.ts", {
  eager: true,
});

const docsRoot = process.cwd();
const currentTest = join(docsRoot, "src", "session-pages.test.ts");
const sourceRoots = ["src", "scripts"] as const;
const sourceExtensions = new Set([".ts", ".tsx", ".astro", ".mdx", ".mjs"]);

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
  "01-state-transitions",
  "02-adt-and-exhaustiveness",
  "03-boundaries-and-pii",
  "04-workflow-errors",
  "06-effects-and-consistency",
] as const;

type ExerciseSlug = (typeof exerciseSlugs)[number];

const exerciseContracts = {
  "01-state-transitions": {
    workspace: {
      slug: "01-state-transitions",
      snapshot: "session-01",
      initialFile: "exercises/state-modeling.test.ts",
      description:
        "演習の要件と作成対象を、開始スナップショットで確認します。",
      visibleFiles: [
        "exercises/state-modeling.test.ts",
        "test/transitions.test.ts",
        "test/setup.test.ts",
        "src/domain/appointment/appointment.ts",
        "src/domain/appointment/transitions.ts",
      ],
    },
    navigation: {
      previous: {
        href: "/sessions/00-system-handover/",
        title: "業務とシステムを引き継ぐ",
      },
      next: {
        href: "/sessions/02-adt-and-exhaustiveness/",
        title: "予約の状態の分岐漏れを型で検出する",
      },
    },
  },
  "02-adt-and-exhaustiveness": {
    workspace: {
      slug: "02-adt-and-exhaustiveness",
      snapshot: "session-02",
      initialFile: "exercises/state-modeling.test.ts",
      description:
        "表示名の分岐と予約状態の定義を、開始スナップショットで確認します。",
      visibleFiles: [
        "exercises/state-modeling.test.ts",
        "src/domain/appointment/appointment.ts",
        "src/domain/appointment/statusLabel.ts",
      ],
    },
    navigation: {
      previous: {
        href: "/sessions/01-state-transitions/",
        title: "予約の状態と遷移をモデル化する",
      },
      next: {
        href: "/sessions/03-boundaries-and-pii/",
        title: "診察開始の入力を境界で検証する",
      },
    },
  },
  "03-boundaries-and-pii": {
    workspace: {
      slug: "03-boundaries-and-pii",
      snapshot: "session-03",
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
        href: "/sessions/02-adt-and-exhaustiveness/",
        title: "予約の状態の分岐漏れを型で検出する",
      },
      next: {
        href: "/sessions/04-workflow-errors/",
        title: "失敗をユースケースの結果として扱う",
      },
    },
  },
  "04-workflow-errors": {
    workspace: {
      slug: "04-workflow-errors",
      snapshot: "session-04",
      initialFile: "exercises/result-errors.test.ts",
      description:
        "例外の種類が型に現れず、Web側にcatch漏れがある開始スナップショットを確認します。",
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
        href: "/sessions/03-boundaries-and-pii/",
        title: "診察開始の入力を境界で検証する",
      },
      next: {
        href: "/sessions/05-business-events-and-workflows/",
        title: "データと工程で予約キャンセルを設計する",
      },
    },
  },
  "06-effects-and-consistency": {
    workspace: {
      slug: "06-effects-and-consistency",
      snapshot: "session-06",
      initialFile: "exercises/effects-and-events.test.ts",
      description:
        "出力イベントと副作用の要求を、開始スナップショットで確認します。",
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
        href: "/sessions/05-business-events-and-workflows/",
        title: "データと工程で予約キャンセルを設計する",
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

const splitPageSlugs: readonly ExerciseSlug[] = exerciseSlugs.filter((slug) =>
  splitSessions.some((session) => session.slug === slug),
);

const reviewText = [
  "`as` による型アサーションが入っていないか全文検索して確認します。",
  "`git status --short` で想定外の path がないか確認します。",
  "型検査では確認できないことを、テストまたは実行時に確認して記録します。",
  "Agentへの依頼文",
  "型検査では確認できず、テストまたは実行時に確認すること",
  "自分の業務コードで、今回と同種の問題が起きうる箇所はどこですか。",
] as const;

const reviewPromptFor = {
  "01-state-transitions": "起きてはいけない状態遷移",
  "02-adt-and-exhaustiveness": "未対応のまま残してはいけない分岐",
  "03-boundaries-and-pii": "境界で拒否する入力",
  "04-workflow-errors": "失敗後に実行してはいけない処理",
  "06-effects-and-consistency": "一緒に記録する必要がある値",
} as const satisfies Record<ExerciseSlug, string>;

const peerReviewPromises = [
  "人ではなく変更を見ます。「この変更は」で話し始め、優劣をつけません。",
  "作った本人が、自分の仕組みは何を見ているかを説明します。",
  "複数人で行うときは、全員の仕組みを少なくとも一度は確かめます。",
] as const;

const peerReviewPromisesHref =
  "/sessions/01-state-transitions/peer-review/#peer-review-promises";

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
    "05-business-events-and-workflows",
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
      if (splitPageSlugs.includes(slug)) return;
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

  for (const slug of exerciseSlugs.slice(1).filter((slug) => !splitPageSlugs.includes(slug))) {
    it(`${slug} preserves the hero avatar whitespace emitted by S1`, () => {
      expect(sourceFor(slug)).toContain(
        `<p class="case-file__summary">\n          <span aria-hidden="true">{session.animal.avatar}</span>\n          {session.summary}\n        </p>`,
      );
    });
  }

  for (const { slug, sessionPages } of splitSessions) {
    it(`${slug} serves one prose file per page, and passes no props to it`, () => {
      const proseNames = Object.keys(splitProseSources)
        .filter((path) => path.startsWith(`./sessions/prose/${slug}/`))
        .map((path) => path.replace(/^.*\//, "").replace(/\.mdx$/, ""))
        .sort();
      const expectedNames = sessionPages
        .map((page) => (page.slug === "" ? "index" : page.slug))
        .sort();
      const routePaths = Object.keys(splitRouteSources).filter((path) =>
        path.startsWith(`./pages/sessions/${slug}/`),
      );
      const firstPage = pageSources[`./pages/sessions/${slug}.astro`] ?? "";

      expect(proseNames).toEqual(expectedNames);
      expect(routePaths).toEqual([`./pages/sessions/${slug}/[page].astro`]);
      expect(splitRouteSources[routePaths[0]!]).toContain("getStaticPaths");
      expect(firstPage).toContain("<Prose />");
      expect(firstPage).toContain(`prose/${slug}/index.mdx`);
    });
  }

  it("S1 owns the peer-review promises on its peer-review page", () => {
    const source =
      splitProseSources["./sessions/prose/01-state-transitions/peer-review.mdx"] ?? "";

    expect(moduleFor("01-state-transitions").promisesHref).toBe(
      peerReviewPromisesHref,
    );
    expect(source).toContain('id="peer-review-promises"');
    for (const promise of peerReviewPromises) expect(source).toContain(promise);
  });

  for (const slug of exerciseSlugs.slice(1)) {
    it(`${slug} owns the S1 peer-review promises href`, () => {
      expect(moduleFor(slug).promisesHref).toBe(peerReviewPromisesHref);
      expect(sourceFor(slug)).not.toContain('id="peer-review-promises"');
    });
  }

  it("S6 owns the completed-file solution and failure-boundary contract", () => {
    const session = moduleFor("06-effects-and-consistency").session;
    const twoPaths =
      splitProseSources[
        "./sessions/prose/06-effects-and-consistency/two-paths.mdx"
      ] ?? "";

    expect(session?.solutionPresentation).toBe("completed-file");
    expect(
      session?.steps.every((step) =>
        step.solutions.every(
          ({ presentation }) => presentation === "completed-file",
        ),
      ),
    ).toBe(true);
    expect(twoPaths).toContain("業務エラー");
    expect(twoPaths).toContain("システムエラー");
  });
});
