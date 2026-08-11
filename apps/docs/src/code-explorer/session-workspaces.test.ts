import { describe, expect, it } from "vitest";
import { sessions } from "../sessions/catalog";
import { projectFilesFor } from "./project-files";
import { sessionWorkspaceFor } from "./session-workspaces";

const expectedSnapshots = {
  "00-onboarding": "session-00",
  "01-invariants": "session-01",
  "02-state-vocabulary": "session-02",
  "03-state-transitions": "session-03",
  "04-awaiting-payment": "session-04",
  "05-cancellation": "session-05",
  "06-input-boundary": "session-06",
  "07-meaningful-values": "session-07",
  "08-pii-output": "session-08",
  "09-typed-failures": "session-09",
  "10-success-events": "session-10",
  "11-use-case-ports": "session-11",
  "12-atomicity-and-conflicts": "session-12",
  "13-safe-follow-up": "session-13",
  final: "final",
} as const;

const exerciseEditTargets = {
  "13-safe-follow-up": [
    "src/domain/followUp/collectFollowUpTargets.ts",
    "src/useCase/requestFollowUpUseCase.ts",
  ],
} as const;

const requiredVisibleFiles = {
  "00-onboarding": [
    "exercises/incident.test.ts",
    "test/setup.test.ts",
    "src/appointment.ts",
    "src/logger.ts",
  ],
  "01-invariants": [
    "exercises/state-modeling.test.ts",
    "test/incident-requirements.test.ts",
    "src/appointment.ts",
    "src/logger.ts",
    "src/visit-lifecycle.ts",
  ],
  "02-state-vocabulary": [
    "exercises/state-vocabulary.test.ts",
    "test/state-modeling.test.ts",
    "src/state-vocabulary.ts",
  ],
  "03-state-transitions": [
    "exercises/state-transitions.test.ts",
    "test/state-modeling.test.ts",
    "src/domain/appointment.ts",
  ],
  "04-awaiting-payment": [
    "exercises/awaiting-payment.test.ts",
    "test/state-modeling.test.ts",
    "src/domain/appointment.ts",
  ],
  "05-cancellation": [
    "exercises/cancellation.test.ts",
    "test/state-modeling.test.ts",
    "src/domain/appointment.ts",
  ],
  "06-input-boundary": [
    "exercises/input-boundary.test.ts",
    "test/cancellation.test.ts",
    "src/domain/appointment.ts",
  ],
  "07-meaningful-values": [
    "exercises/value-meaning.test.ts",
    "test/start-examination-input.test.ts",
    "src/domain/appointment.ts",
    "src/domain/shared/schemaResult.ts",
    "src/domain/startExaminationInput.ts",
  ],
  "08-pii-output": [
    "exercises/pii-redaction.test.ts",
    "test/value-objects.test.ts",
    "src/domain/appointmentId.ts",
    "src/domain/ownerId.ts",
    "src/domain/paymentAmount.ts",
    "src/domain/petId.ts",
    "src/domain/timestamp.ts",
  ],
  "09-typed-failures": [
    "exercises/typed-failures.test.ts",
    "test/owner-contact.test.ts",
    "src/domain/appointment.ts",
    "src/domain/appointmentId.ts",
    "src/domain/ownerContact.ts",
    "src/domain/ownerId.ts",
    "src/domain/petId.ts",
    "src/domain/shared/sensitive.ts",
  ],
  "10-success-events": [
    "exercises/success-events.test.ts",
    "test/start-examination-errors.test.ts",
    "src/domain/appointment.ts",
    "src/domain/appointmentId.ts",
    "src/domain/ownerId.ts",
    "src/domain/petId.ts",
    "src/domain/startExaminationErrors.ts",
    "src/domain/timestamp.ts",
  ],
  "11-use-case-ports": [
    "exercises/use-case-ports.test.ts",
    "test/success-events.test.ts",
    "src/domain/appointment.ts",
    "src/domain/appointmentExaminationStarted.ts",
    "src/domain/appointmentId.ts",
    "src/domain/domainEvent.ts",
    "src/domain/ownerId.ts",
    "src/domain/petId.ts",
    "src/domain/timestamp.ts",
    "src/domain/veterinarianId.ts",
  ],
  "12-atomicity-and-conflicts": [
    "exercises/atomicity-and-conflicts.test.ts",
    "test/use-case-ports.test.ts",
    "src/domain/appointment.ts",
    "src/domain/appointmentExaminationStarted.ts",
    "src/domain/appointmentId.ts",
    "src/domain/appointmentResolver.ts",
    "src/domain/appointmentStores.ts",
    "src/domain/domainEvent.ts",
    "src/domain/ownerId.ts",
    "src/domain/petId.ts",
    "src/domain/repositoryError.ts",
    "src/domain/startExaminationErrors.ts",
    "src/domain/startExaminationInput.ts",
    "src/domain/timestamp.ts",
    "src/domain/veterinarianId.ts",
    "src/useCase/startExaminationUseCase.ts",
  ],
  "13-safe-follow-up": [
    "exercises/safe-follow-up.test.ts",
    "test/atomicity-and-conflicts.test.ts",
    "src/adaptor/inMemoryAppointmentEventStore.ts",
    "src/domain/appointment.ts",
    "src/domain/appointmentExaminationStarted.ts",
    "src/domain/appointmentId.ts",
    "src/domain/appointmentResolver.ts",
    "src/domain/appointmentStores.ts",
    "src/domain/domainEvent.ts",
    "src/domain/examId.ts",
    "src/domain/followUp/collectFollowUpTargets.ts",
    "src/domain/followUp/followUpRequested.ts",
    "src/domain/ownerContact.ts",
    "src/domain/ownerId.ts",
    "src/domain/paymentAmount.ts",
    "src/domain/petId.ts",
    "src/domain/repositoryError.ts",
    "src/domain/shared/schemaResult.ts",
    "src/domain/shared/sensitive.ts",
    "src/domain/startExaminationErrors.ts",
    "src/domain/startExaminationInput.ts",
    "src/domain/timestamp.ts",
    "src/domain/user/user.ts",
    "src/domain/user/userId.ts",
    "src/domain/veterinarianId.ts",
    "src/useCase/requestFollowUpUseCase.ts",
    "src/useCase/startExaminationUseCase.ts",
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
  it("keeps every incremental session in workshop order", () => {
    expect(sessions.map((session) => session.sequence)).toEqual([
      "00", "01", "02", "03", "04", "05", "06", "07", "08", "09",
      "10", "11", "12", "13", "Final",
    ]);
  });

  it("opens the Session 12 atomicity exercise first", () => {
    expect(sessionWorkspaceFor("12-atomicity-and-conflicts")).toMatchObject({
      snapshot: "session-12",
      initialFile: "exercises/atomicity-and-conflicts.test.ts",
    });
  });

  it("shows every declared edit target for each exercise", () => {
    for (const [slug, editTargets] of Object.entries(exerciseEditTargets)) {
      expect(sessionWorkspaceFor(slug).visibleFiles).toEqual(
        expect.arrayContaining([...editTargets]),
      );
    }
  });

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
      if (session.slug === "final") {
        expect(workspace.visibleFiles).toEqual(
          expect.arrayContaining([...requiredVisibleFiles[session.slug]]),
        );
      } else {
        expect(workspace.visibleFiles).toEqual(requiredVisibleFiles[session.slug]);
      }
      expect(workspace.initialFile).toBe(requiredVisibleFiles[session.slug][0]);
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

  it("keeps later exercise source absent from incremental snapshots", () => {
    expect(projectFilesFor("02-state-vocabulary")["src/domain/appointment.ts"]).toBeUndefined();
    expect(projectFilesFor("06-input-boundary")["src/domain/startExaminationInput.ts"]).toBeUndefined();
    expect(projectFilesFor("07-meaningful-values")["src/domain/appointmentId.ts"]).toBeUndefined();
    expect(projectFilesFor("08-pii-output")["src/domain/ownerContact.ts"]).toBeUndefined();
    expect(projectFilesFor("09-typed-failures")["src/domain/appointmentExaminationStarted.ts"]).toBeUndefined();
    expect(projectFilesFor("10-success-events")["src/useCase/startExaminationUseCase.ts"]).toBeUndefined();
    expect(projectFilesFor("11-use-case-ports")["src/adaptor/inMemoryAppointmentEventStore.ts"]).toBeUndefined();
    expect(projectFilesFor("12-atomicity-and-conflicts")["src/domain/followUp/collectFollowUpTargets.ts"]).toBeUndefined();
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
