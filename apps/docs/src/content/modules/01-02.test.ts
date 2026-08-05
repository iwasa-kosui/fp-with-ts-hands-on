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

  it("teaches cancellation from either pre-examination state with its complete Canceled data", () => {
    const stateShape = stateModelingModule.blocks.find(
      (block) => block.kind === "code" && block.heading === "状態とデータを同時に閉じる",
    );

    expect(stateModelingModule.invariant).toContain("Scheduled または CheckedIn から Canceled へキャンセルできる");
    expect(stateShape).toMatchObject({
      kind: "code",
      code: expect.stringContaining(
        'Readonly<{ kind: "Canceled"; id: AppointmentId; reason: CancelReason; canceledAt: string; followUpRequestedAt?: string }>',
      ),
    });
  });

  it("separates exercise runtime requirements from compile-time invalid combinations", () => {
    expect(stateModelingModule.filesToRead).toEqual(
      expect.arrayContaining([
        {
          file: "exercises/01-state-modeling.test.ts",
          focus: expect.stringContaining("実行時要件"),
        },
        {
          file: "test/01-state-modeling.test.ts",
          focus: expect.stringMatching(/@ts-expect-error.*コンパイル時/),
        },
      ]),
    );
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
