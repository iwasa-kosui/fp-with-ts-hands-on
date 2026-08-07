import { describe, expect, it } from "vitest";

import { ExamResult } from "../src/boundary/exam-result.js";
import { OwnerContact } from "../src/boundary/owner-contact.js";
import { OwnerId } from "../src/domain/owner-id.js";
import { PetId } from "../src/domain/pet-id.js";

describe("Session 04 boundary and IDs", () => {
  it("不正な外部検査 payload を ValidationError として返す", () => {
    const result = ExamResult.parse({
      examId: "77777777-7777-4777-8777-777777777777",
      petId: "22222222-2222-4222-8222-222222222222",
      collectedAt: "not-a-date",
      items: [],
    });

    expect(result.isErr() && result.error.kind).toBe("ValidationError");
  });

  it("省略された再診フラグを false として境界で補う", () => {
    const result = ExamResult.parse({
      examId: "77777777-7777-4777-8777-777777777777",
      petId: "22222222-2222-4222-8222-222222222222",
      collectedAt: "2026-08-30T06:50:00.000Z",
      items: ["skin scraping"],
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.needsFollowUp).toBe(false);
    }
  });

  it("種類の異なる UUID を用途別 ID として混同できない", () => {
    const petId = PetId.parse("22222222-2222-4222-8222-222222222222");

    expect(petId.isOk()).toBe(true);
    if (petId.isOk()) {
      // @ts-expect-error PetId を OwnerId として使えません。
      const ownerId: OwnerId = petId.value;
      void ownerId;
    }
  });

  it("飼い主の連絡先を JSON と文字列でマスクする", () => {
    const result = OwnerContact.parse({
      ownerName: "Owner A",
      ownerEmail: "owner@example.test",
      ownerPhone: "090-0000-0000",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(JSON.stringify(result.value)).toContain("[REDACTED]");
      expect(JSON.stringify(result.value)).not.toContain("owner@example.test");
      expect(result.value.ownerPhone.toString()).toBe("[REDACTED]");
    }
  });
});
