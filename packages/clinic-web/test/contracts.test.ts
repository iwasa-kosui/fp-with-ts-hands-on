import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { noticeFromCode, notImplemented } from "../src/server.js";

describe("noticeFromCode", () => {
  it("許可したcodeだけをnoticeへ変換する", () => {
    expect(noticeFromCode("not-implemented")).toEqual({
      kind: "FeatureNotImplemented",
    });
    expect(noticeFromCode("invalid-state")).toEqual({
      kind: "InvalidAppointmentState",
    });
    expect(noticeFromCode("not-found")).toEqual({
      kind: "AppointmentNotFound",
    });
    expect(noticeFromCode("conflict")).toEqual({
      kind: "AppointmentConflict",
    });
  });

  it("任意の文字列をnoticeへ流さない", () => {
    expect(noticeFromCode("<script>alert(1)</script>")).toBeNull();
    expect(noticeFromCode(undefined)).toBeNull();
  });
});

describe("notImplemented", () => {
  it("POST後の遷移をGETへ固定する", async () => {
    const app = new Hono().post("/feature", notImplemented);

    const response = await app.request("/feature", { method: "POST" });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?notice=not-implemented");
  });
});
