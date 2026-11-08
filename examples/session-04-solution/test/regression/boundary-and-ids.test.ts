import { inspect } from "node:util";
import { describe, expect, expectTypeOf, it } from "vitest";

import { ExamResult } from "../../src/boundary/examResult.js";
import { OwnerContact } from "../../src/boundary/ownerContact.js";
import { compileTypeFixture } from "./compileTypeFixture.js";
import { clinicFixture } from "../../../fixtures/clinic.js";

const { examId: EXAM_ID, ownerContact: VALID_CONTACT } = clinicFixture;

describe("S4 regression: 外部境界と PII", () => {
  it("形の違う検査 JSON はドメイン型にならない", () => {
    expect(ExamResult.parse({ examId: EXAM_ID, items: [] }).isErr()).toBe(true);
  });

  it("電話番号とメールはログへ出ない", () => {
    const contact = OwnerContact.parse(VALID_CONTACT)._unsafeUnwrap();
    expect(JSON.stringify(contact)).not.toContain(VALID_CONTACT.ownerEmail);
    expect(inspect(contact)).not.toContain(VALID_CONTACT.ownerPhone);
  });

  it("schema が返す値を OwnerContact として使える", () => {
    expectTypeOf(OwnerContact.parse(VALID_CONTACT)._unsafeUnwrap()).toMatchTypeOf<OwnerContact>();
  });

  it("境界値と配列は読み取り専用", () => {
    expect(compileTypeFixture("s4-exam-result-readonly.ts")).toEqual([]);
  });
});
