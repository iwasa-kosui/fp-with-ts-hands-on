import { expect, it } from "vitest";

import { paidAppointment } from "../test/fixtures.js";

const rawCandidates = [
  {
    appointment: paidAppointment,
    ownerContact: {
      ownerName: "Owner A",
      ownerEmail: "owner@example.test",
      ownerPhone: "090-0000-0000",
    },
    examResult: {
      examId: "77777777-7777-4777-8777-777777777777",
      petId: "22222222-2222-4222-8222-222222222222",
      collectedAt: "2026-08-30T06:50:00.000Z",
      needsFollowUp: true,
      items: ["skin scraping"],
    },
    eventId: "66666666-6666-4666-8666-666666666666",
    occurredAt: "2026-08-30T07:00:00.000Z",
  },
] as const;

it("電話フォロー対象と event を副作用なしに組み立てる", async () => {
  const { collectFollowUpTargets } =
    await import("../src/application/collect-follow-up-targets.js");
  const result = collectFollowUpTargets(rawCandidates);

  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.event.kind).toBe("FollowUpRequested");
    expect(JSON.stringify(result.value)).not.toContain("090-0000-0000");
  }
});

it("検査結果の pet ID が予約と違う候補は途中結果を返さない", async () => {
  const { collectFollowUpTargets } =
    await import("../src/application/collect-follow-up-targets.js");
  const result = collectFollowUpTargets([
    ...rawCandidates,
    {
      ...rawCandidates[0],
      examResult: { ...rawCandidates[0].examResult, petId: "88888888-8888-4888-8888-888888888888" },
    },
  ]);

  expect(result.isErr() && result.error.kind).toBe("ExamResultPetMismatch");
});
