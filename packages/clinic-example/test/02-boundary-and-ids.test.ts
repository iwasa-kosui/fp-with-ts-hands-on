import { describe, expect, test } from "vitest";
import { ExamResult } from "../src/clinic/exam-result.js";
import { OwnerContact } from "../src/clinic/owner-contact.js";
import { OwnerId } from "../src/clinic/owner-id.js";
import { PetId } from "../src/clinic/pet-id.js";

describe("02 境界と ID", () => {
  test("外部検査 payload を検証する", () => {
    const parsed = ExamResult.safeParse({
      examId: "exam_001", petId: "pet_001", collectedAt: "2026-08-30T06:30:00.000Z",
      needsFollowUp: true, items: [{ code: "ALT", value: 42, unit: "U/L" }],
    });
    expect(parsed.success).toBe(true);
    expect(ExamResult.safeParse({ examId: "exam_001", petId: "pet_001", collectedAt: "2026-08-30T06:30:00.000Z" }).success).toBe(false);
  });

  test("飼い主の連絡先をランタイムで伏せる", () => {
    const parsed = OwnerContact.safeParse({ ownerName: "Owner A", ownerEmail: "owner@example.test", ownerPhone: "090-0000-0000" });
    if (!parsed.success) throw new Error("owner contact should parse");
    expect(parsed.data.ownerEmail.unwrap()).toBe("owner@example.test");
    const logged = JSON.stringify(parsed.data);
    expect(logged).toContain("[REDACTED]");
    expect(logged).not.toContain("owner@example.test");
    expect(logged).not.toContain("090-0000-0000");
  });
});

const petId = PetId.schema.parse("pet_001");
// @ts-expect-error PetId and OwnerId are not interchangeable.
const ownerId: OwnerId = petId;
void ownerId;
