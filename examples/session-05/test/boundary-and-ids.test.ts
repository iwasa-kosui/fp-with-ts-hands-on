import { inspect } from "node:util";
import { describe, expect, it } from "vitest";

import { ExamResult } from "../src/boundary/exam-result.js";
import { OwnerContact } from "../src/boundary/owner-contact.js";
import { EventId } from "../src/domain/event-id.js";
import { OwnerId } from "../src/domain/owner-id.js";
import { PetId } from "../src/domain/pet-id.js";
import { Timestamp } from "../src/domain/timestamp.js";

describe("Session 05 boundary and IDs", () => {
  it("unknown の検査結果を用途別 UUID と日時で検証する", () => {
    const result = ExamResult.parse({
      examId: "77777777-7777-4777-8777-777777777777",
      petId: "22222222-2222-4222-8222-222222222222",
      collectedAt: "2026-08-30T06:50:00.000Z",
      needsFollowUp: true,
      items: ["skin scraping"],
    });

    expect(result.isOk()).toBe(true);
  });

  it("EventId は UUID、Timestamp は ISO datetime だけを受け入れる", () => {
    expect(EventId.parse("66666666-6666-4666-8666-666666666666").isOk()).toBe(true);
    expect(EventId.parse("event-1").isErr()).toBe(true);
    expect(Timestamp.parse("2026-08-30T06:30:00.000Z").isOk()).toBe(true);
    expect(Timestamp.parse("2026/08/30 06:30").isErr()).toBe(true);
  });

  it("用途別 ID を取り違えられない", () => {
    const petId = PetId.parse("22222222-2222-4222-8222-222222222222")._unsafeUnwrap();

    // @ts-expect-error PetId を OwnerId として使えません。
    const ownerId: OwnerId = petId;
    void ownerId;
  });

  it("Node inspect でも連絡先を公開しない", () => {
    const contact = OwnerContact.parse({
      ownerName: "Owner A",
      ownerEmail: "owner@example.test",
      ownerPhone: "090-0000-0000",
    })._unsafeUnwrap();

    expect(inspect(contact)).toContain("[REDACTED]");
    expect(inspect(contact)).not.toContain("owner@example.test");
    expect(inspect(contact)).not.toContain("090-0000-0000");
  });
});
