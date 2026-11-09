import { describe, expect, it } from "vitest";

import { startExaminationFor } from "../subjects/callers.js";
import { appointments } from "./states.js";

describe("startExaminationFor", () => {
  it("来院済み以外の予約を渡したときの結果", () => {
    const others = appointments.filter((appointment) => appointment.kind !== "CheckedIn");
    // ここに、others の予約を startExaminationFor に渡したときの結果を確かめる式を書きます
  });
});
