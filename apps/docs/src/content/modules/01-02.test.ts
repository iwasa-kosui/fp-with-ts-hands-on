import { describe, expect, it } from "vitest";
import { assertModuleMeetsPrd } from "../module-content";
import { stateModelingModule } from "./01-state-modeling";
import { boundaryAndIdsModule } from "./02-boundary-and-ids";

describe("state modeling and boundary modules", () => {
  it("starts state modeling from the new cancellation requirement and limits edits to transitions", () => {
    expect(stateModelingModule.trigger.kind).toBe("new-requirement");
    expect(stateModelingModule.editTargets.map(({ symbol }) => symbol)).toEqual([
      "Appointment.startExamination",
      "Appointment.cancelWithReason",
    ]);
    expect(() => assertModuleMeetsPrd(stateModelingModule)).not.toThrow();
  });

  it("starts boundary protection from the ID and PII incident and limits edits to parsers", () => {
    expect(boundaryAndIdsModule.trigger.kind).toBe("incident");
    expect(boundaryAndIdsModule.editTargets.map(({ symbol }) => symbol)).toEqual([
      "ExamResult.safeParse",
      "OwnerContact.safeParse",
    ]);
    expect(() => assertModuleMeetsPrd(boundaryAndIdsModule)).not.toThrow();
  });
});
