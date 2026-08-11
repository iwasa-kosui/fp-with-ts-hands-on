import { describe, expect, it } from "vitest";

import { AppointmentId } from "../src/domain/appointmentId.js";
import { PaymentAmount } from "../src/domain/paymentAmount.js";
import { PetId } from "../src/domain/petId.js";
import { OwnerId } from "../src/domain/ownerId.js";
import { Timestamp } from "../src/domain/timestamp.js";

describe("値の意味", () => {
  it("用途の違う ID を代入できない", () => {
    const petId = PetId.schema.parse("22222222-2222-4222-8222-222222222222");

    if (false) {
      // @ts-expect-error PetId cannot satisfy OwnerId.
      const ownerId: OwnerId = petId;
      void ownerId;
    }

    expect(AppointmentId.parse("11111111-1111-4111-8111-111111111111").isOk()).toBe(true);
  });

  it("不正な日時と会計金額を拒否する", () => {
    expect(Timestamp.parse("not-a-timestamp").isErr()).toBe(true);
    expect(PaymentAmount.parse(0).isErr()).toBe(true);
    expect(PaymentAmount.parse(4_800.5).isErr()).toBe(true);
  });

  it("有効な日時と正の整数の会計金額を受け入れる", () => {
    expect(Timestamp.parse("2026-08-30T06:30:00.000Z").isOk()).toBe(true);
    expect(PaymentAmount.parse(4_800)._unsafeUnwrap()).toBe(4_800);
  });
});
