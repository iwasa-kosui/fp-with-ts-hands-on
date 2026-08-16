import { describe, expect, it } from "vitest";
import { sessions } from "../../sessions/catalog";
import type { CodeGuide } from "../code-guide";
import { projectFilesFor } from "../project-files";

type GuideModule = Readonly<{ default: readonly CodeGuide[] }>;

const expectedFragments: Readonly<Record<string, readonly string[]>> = {
  "string-status": ["status: string"],
  "optional-state-data": ["veterinarianId?: string"],
  "plain-string-ids": ["ownerId: string"],
  "throw-not-found": ["throw new Error"],
  "raw-pii-log": ["logger.info"],
  "wide-transition-input": ["appointment: Appointment", "as Appointment"],
  "non-exhaustive-label": ["default:"],
  "unvalidated-exam-json": ["raw: any", "examId: raw.examId"],
  "plain-contact-pii": ["ownerEmail: string", "raw: any"],
  "throws-known-errors": ["throw new Error"],
  "catch-collapses-errors": ["try {", "catch {"],
  "hidden-nondeterminism": ["new Date()", "crypto.randomUUID()"],
  "dual-write": ["stateStore.save", "eventLog.append"],
  "final-use-case-pipeline": [".andThrough"],
  "final-seven-aggregates": [
    "createSessionEventStore",
    "createUserEventStore",
    "createOwnerEventStore",
    "createPetEventStore",
    "createAppointmentEventStore",
    "createExaminationCompletionStore",
    "createFollowUpEventStore",
  ],
  "final-transaction-store": ["db.transaction"],
};

const guideModules = import.meta.glob<GuideModule>("./*.ts", { eager: true });

describe("session code guides", () => {
  it("provides source-backed guides for every public Code Explorer session", () => {
    const codeExplorerSessions = sessions.filter(
      ({ kind }) => kind !== "workshop",
    );
    const guideSlugs = Object.keys(guideModules)
      .filter((file) => !file.endsWith(".test.ts"))
      .map((file) => file.replace(/^\.\//, "").replace(/\.ts$/, ""))
      .sort();

    expect(guideSlugs).toEqual(
      codeExplorerSessions.map(({ slug }) => slug).sort(),
    );

    for (const session of codeExplorerSessions) {
      const guides = guideModules[`./${session.slug}.ts`]?.default;
      expect(guides, session.slug).toEqual(expect.any(Array));
      expect(guides!.length).toBeGreaterThanOrEqual(2);
      expect(guides!.length).toBeLessThanOrEqual(
        session.slug === "00-system-handover" ? 5 : 3,
      );
      const files = projectFilesFor(session.slug);

      for (const guide of guides!) {
        expect(guide.title).not.toBe("");
        expect(guide.currentDesign).not.toBe("");
        expect(guide.futureRisk).not.toBe("");
        expect(files[guide.path], `${session.slug}: ${guide.path}`).toEqual(
          expect.any(String),
        );
        expect(sessionWorkspaceVisibleFiles(session.slug)).toContain(
          guide.path,
        );
        const lines = files[guide.path]!.split("\n");
        const highlightedSource = guide.highlights
          .map(({ startLineNumber, endLineNumber }) =>
            lines.slice(startLineNumber - 1, endLineNumber).join("\n"),
          )
          .join("\n");
        expect(
          expectedFragments[guide.id],
          `${session.slug}: ${guide.id}`,
        ).toEqual(expect.any(Array));
        for (const fragment of expectedFragments[guide.id]!) {
          expect(highlightedSource, `${session.slug}: ${guide.id}`).toContain(
            fragment,
          );
        }
        for (const highlight of guide.highlights) {
          expect(highlight.startLineNumber).toBeGreaterThanOrEqual(1);
          expect(highlight.endLineNumber).toBeGreaterThanOrEqual(
            highlight.startLineNumber,
          );
          expect(highlight.endLineNumber).toBeLessThanOrEqual(lines.length);
          expect(
            lines
              .slice(highlight.startLineNumber - 1, highlight.endLineNumber)
              .join("\n")
              .trim(),
          ).not.toBe("");
        }
      }

      if (session.slug === "final") {
        const aggregateGuide = guides!.find(
          ({ id }) => id === "final-seven-aggregates",
        );
        expect(aggregateGuide?.title).toBe(
          "1業務集約から7業務集約へ広がる配線",
        );
        expect(aggregateGuide?.path).toBe("src/app.ts");
      }
    }
  });
});

const sessionWorkspaceVisibleFiles = (slug: string): readonly string[] => {
  const workspaces = import.meta.glob<
    Readonly<{
      sessionWorkspaceFor: (
        slug: string,
      ) => Readonly<{ visibleFiles: readonly string[] }>;
    }>
  >("../session-workspaces.ts", { eager: true });
  return workspaces["../session-workspaces.ts"]!.sessionWorkspaceFor(slug)
    .visibleFiles;
};
