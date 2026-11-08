import { describe, it } from "vitest";

import { cancel } from "../subjects/transitions.js";
import { scheduled } from "./states.js";

describe("遷移関数", () => {
  it("渡した値が、結果のどの項目に入るか", () => {
    const canceled = cancel(scheduled, "owner request", "2026-08-30T05:50:00.000Z");
    // ここに、canceled の項目を渡した値や scheduled の値と比べる式を書きます
  });
});
