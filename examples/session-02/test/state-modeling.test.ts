import { describe, expect, it } from "vitest";

import { appointmentStates, type AppointmentState } from "../src/state-vocabulary.js";

describe("Session 02 state vocabulary", () => {
  it("来院で使う状態語彙を固定する", () => {
    const state: AppointmentState = "CheckedIn";

    expect(appointmentStates).toEqual(["Scheduled", "CheckedIn", "InExamination"]);
    expect(state).toBe("CheckedIn");
  });
});
