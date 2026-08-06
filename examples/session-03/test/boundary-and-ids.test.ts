import { describe, expect, it } from "vitest";

import { ExamResult } from "../src/boundary/exam-result.js";
import { OwnerContact } from "../src/boundary/owner-contact.js";
import { OwnerId } from "../src/domain/owner-id.js";
import { PetId } from "../src/domain/pet-id.js";

describe("Session 03 boundary and IDs", () => {
  it("不正な外部検査 payload を受け入れない", () => {
    const result = ExamResult.safeParse({
      examId: "77777777-7777-4777-8777-777777777777",
      petId: "22222222-2222-4222-8222-222222222222",
      collectedAt: "not-a-date",
      items: [],
    });

    expect(result.success).toBe(false);
  });

  it("省略された再診フラグを false として境界で補う", () => {
    const result = ExamResult.safeParse({
      examId: "77777777-7777-4777-8777-777777777777",
      petId: "22222222-2222-4222-8222-222222222222",
      collectedAt: "2026-08-30T06:50:00.000Z",
      items: ["skin scraping"],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.needsFollowUp).toBe(false);
    }
  });

  it("種類の異なる UUID を用途別 ID として混同できない", () => {
    const petId = PetId.safeParse("22222222-2222-4222-8222-222222222222");

    expect(petId.success).toBe(true);

    if (petId.success) {
      // @ts-expect-error PetId を OwnerId として使えません。
      const ownerId: OwnerId = petId.data;
      void ownerId;
    }
  });

  it("飼い主の連絡先を JSON と文字列でマスクする", () => {
    const result = OwnerContact.safeParse({
      ownerName: "Owner A",
      ownerEmail: "owner@example.test",
      ownerPhone: "090-0000-0000",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(JSON.stringify(result.data)).toContain("[REDACTED]");
      expect(JSON.stringify(result.data)).not.toContain("owner@example.test");
      expect(result.data.ownerPhone.toString()).toBe("[REDACTED]");
    }
  });
});
