import { inspect } from "node:util";
import { describe, expect, it } from "vitest";

import { AppointmentId } from "../src/domain/appointment-id.js";
import { EventId } from "../src/domain/event-id.js";
import { ExamId } from "../src/domain/exam-id.js";
import { ExamResult } from "../src/domain/exam-result.js";
import { OwnerContact } from "../src/domain/owner-contact.js";
import { OwnerEmail, type OwnerEmail as OwnerEmailValue } from "../src/domain/owner-email.js";
import { OwnerId } from "../src/domain/owner-id.js";
import { OwnerName, type OwnerName as OwnerNameValue } from "../src/domain/owner-name.js";
import { OwnerPhone, type OwnerPhone as OwnerPhoneValue } from "../src/domain/owner-phone.js";
import { PaymentAmount, type PaymentAmount as PaymentAmountValue } from "../src/domain/payment-amount.js";
import { PetId } from "../src/domain/pet-id.js";
import { Timestamp } from "../src/domain/timestamp.js";
import { VeterinarianId } from "../src/domain/veterinarian-id.js";
import type { Sensitive } from "../src/shared/sensitive.js";

// @ts-expect-error raw number を PaymentAmount として扱えません。
const rawPaymentAmount: PaymentAmountValue = 4800;
// @ts-expect-error raw string を OwnerName として扱えません。
const rawOwnerName: OwnerNameValue = "Owner A";
// @ts-expect-error raw string を OwnerEmail として扱えません。
const rawOwnerEmail: OwnerEmailValue = "owner@example.test";
// @ts-expect-error raw string を OwnerPhone として扱えません。
const rawOwnerPhone: OwnerPhoneValue = "090-0000-0000";
void [rawPaymentAmount, rawOwnerName, rawOwnerEmail, rawOwnerPhone];

describe("final boundary defense", () => {
  it("用途別 ID は UUID だけを受け入れ、型を取り違えられない", () => {
    expect(AppointmentId.parse("11111111-1111-4111-8111-111111111111").isOk()).toBe(true);
    expect(PetId.parse("22222222-2222-4222-8222-222222222222").isOk()).toBe(true);
    expect(OwnerId.parse("33333333-3333-4333-8333-333333333333").isOk()).toBe(true);
    expect(VeterinarianId.parse("44444444-4444-4444-8444-444444444444").isOk()).toBe(true);
    expect(ExamId.parse("77777777-7777-4777-8777-777777777777").isOk()).toBe(true);
    expect(EventId.parse("66666666-6666-4666-8666-666666666666").isOk()).toBe(true);
    expect(AppointmentId.parse("appointment-1").isErr()).toBe(true);

    const petId = PetId.parse("22222222-2222-4222-8222-222222222222")._unsafeUnwrap();
    // @ts-expect-error PetId を OwnerId として使えません。
    const ownerId: OwnerId = petId;
    void ownerId;
  });

  it("Timestamp は ISO datetime だけを受け入れる", () => {
    expect(Timestamp.parse("2026-08-30T06:30:00.000Z").isOk()).toBe(true);
    expect(Timestamp.parse("2026/08/30 06:30").isErr()).toBe(true);
  });

  it("PaymentAmount は正の有限値だけを受け入れる", () => {
    expect(PaymentAmount.parse(4800).isOk()).toBe(true);
    expect(PaymentAmount.parse(0).isErr()).toBe(true);
    expect(PaymentAmount.parse(-1).isErr()).toBe(true);
    expect(PaymentAmount.parse(Number.POSITIVE_INFINITY).isErr()).toBe(true);
  });

  it("owner の氏名、メール、電話を用途別の値として検証する", () => {
    const ownerName = OwnerName.parse("Owner A");
    const ownerEmail = OwnerEmail.parse("owner@example.test");
    const ownerPhone = OwnerPhone.parse("090-0000-0000");

    expect(ownerName.isOk()).toBe(true);
    expect(ownerEmail.isOk()).toBe(true);
    expect(ownerPhone.isOk()).toBe(true);
    expect(OwnerName.parse("   ").isErr()).toBe(true);
    expect(OwnerEmail.parse("not-an-email").isErr()).toBe(true);
    expect(OwnerPhone.parse("   ").isErr()).toBe(true);

    if (ownerName.isOk()) {
      // @ts-expect-error OwnerName と OwnerEmail は取り違えられません。
      const email: OwnerEmailValue = ownerName.value;
      void email;
    }
  });

  it("unknown の検査結果を一つの境界で検証する", () => {
    const valid = ExamResult.parse({
      examId: "77777777-7777-4777-8777-777777777777",
      petId: "22222222-2222-4222-8222-222222222222",
      collectedAt: "2026-08-30T06:50:00.000Z",
      needsFollowUp: true,
      items: ["skin scraping"],
    });
    const invalid = ExamResult.parse({
      examId: "not-a-uuid",
      petId: "22222222-2222-4222-8222-222222222222",
      collectedAt: "not-a-datetime",
      needsFollowUp: true,
      items: [],
    });
    const defaulted = ExamResult.parse({
      examId: "77777777-7777-4777-8777-777777777777",
      petId: "22222222-2222-4222-8222-222222222222",
      collectedAt: "2026-08-30T06:50:00.000Z",
      items: ["skin scraping"],
    });
    const emptyItems = ExamResult.parse({
      examId: "77777777-7777-4777-8777-777777777777",
      petId: "22222222-2222-4222-8222-222222222222",
      collectedAt: "2026-08-30T06:50:00.000Z",
      needsFollowUp: true,
      items: [],
    });

    expect(valid.isOk()).toBe(true);
    expect(invalid.isErr() && invalid.error.kind).toBe("ValidationError");
    expect(defaulted.isOk()).toBe(true);
    if (defaulted.isOk()) {
      expect(defaulted.value.needsFollowUp).toBe(false);
    }
    expect(emptyItems.isErr() && emptyItems.error.kind).toBe("ValidationError");
  });

  it("owner contact は文字列、JSON、Node inspect のすべてで PII を伏せる", () => {
    const contact = OwnerContact.parse({
      ownerName: "Owner A",
      ownerEmail: "owner@example.test",
      ownerPhone: "090-0000-0000",
    })._unsafeUnwrap();
    const ownerName: Sensitive<OwnerNameValue> = contact.ownerName;
    const ownerEmail: Sensitive<OwnerEmailValue> = contact.ownerEmail;
    const ownerPhone: Sensitive<OwnerPhoneValue> = contact.ownerPhone;
    void [ownerName, ownerEmail, ownerPhone];

    expect(String(contact.ownerPhone)).toBe("[REDACTED]");
    expect(JSON.stringify(contact)).toBe(
      '{"ownerName":"[REDACTED]","ownerEmail":"[REDACTED]","ownerPhone":"[REDACTED]"}',
    );
    expect(inspect(contact)).not.toContain("Owner A");
    expect(inspect(contact)).not.toContain("owner@example.test");
    expect(inspect(contact)).not.toContain("090-0000-0000");
  });

  it.each([
    { ownerName: "   ", ownerEmail: "owner@example.test", ownerPhone: "090-0000-0000" },
    { ownerName: "Owner A", ownerEmail: "not-an-email", ownerPhone: "090-0000-0000" },
    { ownerName: "Owner A", ownerEmail: "owner@example.test", ownerPhone: "   " },
  ])("不正な owner contact を ValidationError として返す", (rawContact) => {
    const result = OwnerContact.parse(rawContact);

    expect(result.isErr() && result.error.kind).toBe("ValidationError");
  });
});
