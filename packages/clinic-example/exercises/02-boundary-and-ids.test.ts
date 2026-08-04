import { describe, expect, test } from "vitest";
import { ExamResult } from "../src/clinic/exam-result.js";
import { OwnerContact } from "../src/clinic/owner-contact.js";

describe("02 境界と ID を守る", () => {
  test("外部検査 payload を検証し、連絡先はログで伏せる", () => {
    const exam = ExamResult.safeParse({
      examId: "exam_001",
      petId: "pet_001",
      collectedAt: "2026-08-30T06:30:00.000Z",
      needsFollowUp: true,
      items: [{ code: "ALT", value: 42, unit: "U/L" }],
    });
    const contact = OwnerContact.safeParse({
      ownerName: "Owner A",
      ownerEmail: "owner@example.test",
      ownerPhone: "090-0000-0000",
    });

    expect(exam.success).toBe(true);
    expect(contact.success).toBe(true);
    if (!contact.success) return;
    expect(JSON.stringify(contact.data)).not.toContain("owner@example.test");
    expect(JSON.stringify(contact.data)).toContain("[REDACTED]");
  });
});
