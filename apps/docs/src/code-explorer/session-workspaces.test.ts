import { describe, expect, it } from "vitest";
import { sessions } from "../sessions/catalog";
import { projectFilesFor } from "./project-files";
import { sessionWorkspaceFor } from "./session-workspaces";

const expectedSnapshots = {
  "00-onboarding": "session-00",
  "01-state-modeling": "session-01",
  "02-boundary-and-ids": "session-02",
  "03-result-errors": "session-03",
  "04-effects-and-events": "session-04",
  "04-agent-review": "session-04",
  "05-mini-integration": "session-05",
  final: "final",
} as const;

const requiredVisibleFiles = {
  "00-onboarding": [
    "src/legacy/appointment.ts",
    "src/legacy/logger.ts",
  ],
  "01-state-modeling": [
    "exercises/state-modeling.test.ts",
    "test/transitions.test.ts",
    "src/domain/appointment/appointment.ts",
    "src/domain/appointment/transitions.ts",
    "src/domain/appointment/statusLabel.ts",
  ],
  "02-boundary-and-ids": [
    "exercises/boundary-and-ids.test.ts",
    "test/regression/state-modeling.test.ts",
    "src/domain/appointment/appointment.ts",
  ],
  "03-result-errors": [
    "exercises/result-errors.test.ts",
    "src/boundary/examResult.ts",
    "src/boundary/ownerContact.ts",
    "src/domain/appointment/appointment.ts",
    "src/domain/ids/appointmentId.ts",
    "src/useCase/startExamination.ts",
    "test/regression/boundary-and-ids.test.ts",
  ],
  "04-agent-review": [
    "exercises/effects-and-events.test.ts",
    "src/domain/aggregate/eventContext.ts",
    "src/domain/appointment/examinationStarted.ts",
    "src/useCase/startExamination.ts",
    "test/regression/result-errors.test.ts",
  ],
  "04-effects-and-events": [
    "exercises/effects-and-events.test.ts",
    "src/domain/aggregate/eventContext.ts",
    "src/domain/appointment/examinationStarted.ts",
    "src/useCase/startExamination.ts",
    "test/regression/result-errors.test.ts",
  ],
  "05-mini-integration": [
    "src/adaptor/inMemoryExaminationStartedStore.ts",
    "src/useCase/startExamination.ts",
    "test/in-memory-store.test.ts",
    "test/regression/effects-and-events.test.ts",
  ],
  final: [
    "test/useCase/startExaminationUseCase.test.ts",
    "test/web/clinicFlow.test.ts",
    "src/app.ts",
    "src/domain/appointment/appointment.ts",
    "src/domain/appointment/appointmentResolver.ts",
    "src/domain/appointment/appointmentStores.ts",
    "src/useCase/startExaminationUseCase.ts",
    "src/adaptor/primary/web/routes/appointmentRoutes.ts",
    "src/adaptor/secondary/sqlite/resolver/appointmentResolver.ts",
    "src/adaptor/secondary/sqlite/store/appointmentEventStore.ts",
  ],
} as const;

describe("session code workspaces", () => {
  it("maps every catalog entry to its self-contained example snapshot", () => {
    for (const session of sessions) {
      expect(session.snapshot).toBe(expectedSnapshots[session.slug]);
      expect(sessionWorkspaceFor(session.slug).snapshot).toBe(session.snapshot);
    }
  });

  it("mounts a runnable manifest, local TypeScript config, and real visible files", () => {
    for (const session of sessions) {
      const workspace = sessionWorkspaceFor(session.slug);
      const projectFiles = projectFilesFor(session.slug);
      const packageJson = JSON.parse(projectFiles["package.json"]!) as {
        name: string;
        devDependencies?: Record<string, string>;
      };
      const tsconfig = JSON.parse(projectFiles["tsconfig.json"]!) as {
        extends: string;
      };

      expect(packageJson.name).toBe(
        session.snapshot === "final"
          ? "@fp-with-ts/clinic-final"
          : `@fp-with-ts/clinic-${session.snapshot}`,
      );
      expect(packageJson.devDependencies?.tsx).toBe("4.23.9");
      expect(tsconfig.extends).toBe("./tsconfig.base.json");
      expect(projectFiles["tsconfig.base.json"]).toEqual(expect.any(String));
      expect(projectFiles["vitest.config.ts"]).toEqual(expect.any(String));
      expect(workspace.visibleFiles).toEqual(
        expect.arrayContaining([...requiredVisibleFiles[session.slug]]),
      );
      expect(workspace.visibleFiles).toContain(workspace.initialFile);
      expect(new Set(workspace.visibleFiles).size).toBe(
        workspace.visibleFiles.length,
      );
      for (const path of workspace.visibleFiles) {
        expect(projectFiles[path], `${session.slug}: ${path}`).toEqual(
          expect.any(String),
        );
      }
    }
  });

  it("provides each snapshot's current exercise and solution-chain files", () => {
    expect(
      projectFilesFor("01-state-modeling")[
        "src/domain/appointment/transitions.ts"
      ],
    ).toEqual(expect.any(String));
    expect(
      projectFilesFor("02-boundary-and-ids")["src/boundary/examResult.ts"],
    ).toEqual(expect.any(String));
    expect(
      projectFilesFor("03-result-errors")["src/useCase/startExamination.ts"],
    ).toEqual(expect.any(String));
    expect(
      projectFilesFor("04-agent-review")[
        "exercises/effects-and-events.test.ts"
      ],
    ).toEqual(expect.any(String));
    expect(
      projectFilesFor("05-mini-integration")[
        "src/useCase/startExamination.ts"
      ],
    ).toEqual(expect.any(String));
    expect(
      Object.keys(projectFilesFor("05-mini-integration")).some((path) =>
        path.startsWith("exercises/"),
      ),
    ).toBe(false);
  });

  it("rejects unknown session slugs before rendering", () => {
    expect(() => sessionWorkspaceFor("not-a-session")).toThrow(
      "Unknown session workspace: not-a-session",
    );
    expect(() => projectFilesFor("not-a-session")).toThrow(
      "Unknown session project: not-a-session",
    );
  });

  it("returns visible files that cannot corrupt a later workspace result", () => {
    const firstWorkspace = sessionWorkspaceFor("00-onboarding");
    expect(() => {
      (firstWorkspace.visibleFiles as string[]).push("src/unexpected.ts");
    }).toThrow();

    expect(
      sessionWorkspaceFor("00-onboarding").visibleFiles,
    ).not.toContain("src/unexpected.ts");
  });
});
