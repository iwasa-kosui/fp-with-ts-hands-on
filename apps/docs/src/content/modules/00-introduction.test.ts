import { describe, expect, it } from "vitest";
import { assertModuleMeetsPrd } from "../module-content";
import { breakTheAppModule } from "./00-break-the-app";
import { readTheIncidentModule } from "./00-read-the-incident";

describe("introduction modules", () => {
  it("事故を再現する導入は incident から始まる", () => {
    expect(breakTheAppModule.trigger.kind).toBe("incident");
    expect(breakTheAppModule.editTargets).toHaveLength(0);
    expect(breakTheAppModule.red.command).toContain("exercise:00");
    expect(() => assertModuleMeetsPrd(breakTheAppModule)).not.toThrow();
  });

  it("要求整理は new-requirement から始まる", () => {
    expect(readTheIncidentModule.trigger.kind).toBe("new-requirement");
    expect(readTheIncidentModule.editTargets).toHaveLength(0);
    expect(readTheIncidentModule.red.command).toContain("exercise:01");
    expect(() => assertModuleMeetsPrd(readTheIncidentModule)).not.toThrow();
  });
});
