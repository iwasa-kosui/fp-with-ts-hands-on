import { describe, expect, it } from "vitest";
import { sessions } from "../sessions/catalog";
import { projectFilesFor } from "./project-files";
import { sessionWorkspaceFor } from "./session-workspaces";

const expectedSnapshots = {
  "00-onboarding": "session-00",
  "01-state-modeling": "session-01",
  "02-boundary-and-ids": "session-02",
  "03-result-errors": "session-03",
  "04-agent-review": "session-04",
  "05-mini-integration": "session-05",
  final: "final",
} as const;

const requiredVisibleFiles = {
  "00-onboarding": [
    "src/appointment.ts",
    "src/logger.ts",
  ],
  "01-state-modeling": [
    "exercises/state-modeling.test.ts",
    "test/incident-requirements.test.ts",
    "src/appointment.ts",
    "src/visit-lifecycle.ts",
  ],
  "02-boundary-and-ids": [
    "exercises/boundary-and-ids.test.ts",
    "test/state-modeling.test.ts",
    "src/domain/appointment.ts",
  ],
  "03-result-errors": [
    "exercises/result-errors.test.ts",
    "src/boundary/exam-result.ts",
    "src/boundary/owner-contact.ts",
    "src/domain/appointment.ts",
    "test/boundary-and-ids.test.ts",
  ],
  "04-agent-review": [
    "exercises/agent-review.test.ts",
    "src/application/start-examination.ts",
    "src/infrastructure/in-memory-appointment-repository.ts",
    "src/infrastructure/in-memory-domain-event-store.ts",
    "src/review/agent-review.ts",
    "test/result-errors.test.ts",
  ],
  "05-mini-integration": [
    "exercises/follow-up.test.ts",
    "src/application/start-examination.ts",
    "src/infrastructure/in-memory-appointment-gateway.ts",
    "src/review/agent-review.ts",
    "test/start-examination.test.ts",
  ],
  final: [
    "test/follow-up.test.ts",
    "src/application/collect-follow-up-targets.ts",
    "src/application/start-examination.ts",
    "src/domain/appointment.ts",
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

  it("keeps later exercise source absent while providing the editable Session 04 review starter", () => {
    expect(projectFilesFor("01-state-modeling")["src/domain/appointment.ts"]).toBeUndefined();
    expect(projectFilesFor("02-boundary-and-ids")["src/boundary/exam-result.ts"]).toBeUndefined();
    expect(projectFilesFor("03-result-errors")["src/application/start-examination.ts"]).toBeUndefined();
    expect(projectFilesFor("04-agent-review")["src/review/agent-review.ts"]).toEqual(
      expect.any(String),
    );
    expect(projectFilesFor("05-mini-integration")["src/application/collect-follow-up-targets.ts"]).toBeUndefined();
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
