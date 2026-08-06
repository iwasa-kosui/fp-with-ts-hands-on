import { describe, expect, it } from "vitest";
import { modules } from "../modules/catalog";
import { moduleWorkspaceFor } from "./module-workspaces";
import { projectFiles } from "./project-files";

const requiredFiles = {
  "00-break-the-app": [
    "src/legacy/appointment.ts",
    "src/legacy/logger.ts",
    "exercises/00-incident.test.ts",
    "test/00-setup.test.ts",
  ],
  "00-read-the-incident": [
    "src/legacy/appointment.ts",
    "src/clinic/appointment.ts",
    "exercises/01-state-modeling.test.ts",
    "test/01-state-modeling.test.ts",
  ],
  "01-state-modeling": [
    "src/clinic/appointment.ts",
    "src/clinic/appointment-id.ts",
    "src/clinic/pet-id.ts",
    "src/clinic/veterinarian-id.ts",
    "exercises/01-state-modeling.test.ts",
    "test/01-state-modeling.test.ts",
  ],
  "02-boundary-and-ids": [
    "src/clinic/exam-result.ts",
    "src/clinic/owner-contact.ts",
    "src/clinic/owner-id.ts",
    "src/clinic/pet-id.ts",
    "src/shared/sensitive.ts",
    "exercises/02-boundary-and-ids.test.ts",
    "test/02-boundary-and-ids.test.ts",
  ],
  "03-result-errors": [
    "src/clinic/use-cases.ts",
    "src/clinic/appointment-repository.ts",
    "src/clinic/domain-event-store.ts",
    "src/clinic/domain-events.ts",
    "src/shared/result.ts",
    "exercises/03-result-errors.test.ts",
    "test/03-result-errors.test.ts",
  ],
  "04-agent-review": [
    "src/clinic/agent-review.ts",
    "exercises/04-agent-review.test.ts",
    "test/04-agent-review.test.ts",
  ],
  "05-mini-integration": [
    "src/clinic/use-cases.ts",
    "src/clinic/exam-result.ts",
    "src/clinic/owner-contact.ts",
    "src/shared/sensitive.ts",
    "exercises/05-follow-up.test.ts",
    "test/05-follow-up.test.ts",
  ],
} as const;

describe("module code workspaces", () => {
  it("covers every catalog module with real, unique visible files", () => {
    for (const module of modules) {
      const workspace = moduleWorkspaceFor(module.slug);
      expect(workspace.visibleFiles).toEqual(
        expect.arrayContaining([...requiredFiles[module.slug]]),
      );
      expect(workspace.visibleFiles).toContain(workspace.initialFile);
      expect(new Set(workspace.visibleFiles).size).toBe(workspace.visibleFiles.length);
      for (const path of workspace.visibleFiles) {
        expect(projectFiles[path], `${module.slug}: ${path}`).toEqual(expect.any(String));
      }
    }
  });

  it("rejects an unknown module slug", () => {
    expect(() => moduleWorkspaceFor("not-a-module")).toThrow(
      "Unknown module workspace: not-a-module",
    );
  });

  it("returns visible files that cannot corrupt a later workspace result", () => {
    const firstWorkspace = moduleWorkspaceFor("00-break-the-app");
    expect(() => {
      (firstWorkspace.visibleFiles as string[]).push("src/unexpected.ts");
    }).toThrow();

    const laterWorkspace = moduleWorkspaceFor("00-break-the-app");
    expect(laterWorkspace.visibleFiles).not.toContain("src/unexpected.ts");
  });
});
