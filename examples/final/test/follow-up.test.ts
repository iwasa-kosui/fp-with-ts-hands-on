import { describe, expect, it } from "vitest";

import { collectFollowUpTargets } from "../src/application/collect-follow-up-targets.js";
import { paidAppointment, validRawCandidate } from "./fixtures.js";

describe("final follow-up", () => {
  it("Paid、要フォロー、pet ID 一致の候補だけから target と event を組み立てる", () => {
    const result = collectFollowUpTargets([
      validRawCandidate,
      {
        ...validRawCandidate,
        examResult: { ...validRawCandidate.examResult, needsFollowUp: false },
        eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      {
        ...validRawCandidate,
        appointment: { ...paidAppointment, kind: "InExamination" },
        eventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
    ]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toMatchObject({
        appointmentId: "11111111-1111-4111-8111-111111111111",
        petId: "22222222-2222-4222-8222-222222222222",
        event: {
          kind: "FollowUpRequested",
          eventId: "66666666-6666-4666-8666-666666666666",
        },
      });
      expect(JSON.stringify(result.value)).not.toContain("090-0000-0000");
    }
  });

  it("候補配列に不正入力が一件でもあれば部分結果を返さない", () => {
    const result = collectFollowUpTargets([
      validRawCandidate,
      { ...validRawCandidate, eventId: "not-a-uuid" },
    ]);

    expect(result.isErr() && result.error.kind).toBe("ValidationError");
  });

  it("検査結果の pet ID が違う候補が一件でもあれば部分結果を返さない", () => {
    const result = collectFollowUpTargets([
      validRawCandidate,
      {
        ...validRawCandidate,
        examResult: {
          ...validRawCandidate.examResult,
          petId: "88888888-8888-4888-8888-888888888888",
        },
        eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    ]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({
        kind: "ExamResultPetMismatch",
        appointmentId: "11111111-1111-4111-8111-111111111111",
        expectedPetId: "22222222-2222-4222-8222-222222222222",
        actualPetId: "88888888-8888-4888-8888-888888888888",
      });
    }
  });

  it("同じ appointment の候補を最初の一件に deduplicate する", () => {
    const result = collectFollowUpTargets([
      validRawCandidate,
      {
        ...validRawCandidate,
        eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        occurredAt: "2026-08-30T07:10:00.000Z",
      },
    ]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.event.eventId).toBe("66666666-6666-4666-8666-666666666666");
    }
  });
});
