import { inspect } from "node:util";
import { describe, expect, expectTypeOf, it } from "vitest";

import { parseExamResult } from "../src/boundary/examResult.js";
import { parseOwnerContact, type OwnerContact } from "../src/boundary/ownerContact.js";
import { compileTypeFixture } from "./compileTypeFixture.js";
import { clinicFixture } from "../../fixtures/clinic.js";

const { examId: EXAM_ID, ownerContact: VALID_CONTACT } = clinicFixture;

describe("Step 1: 形の違う検査 JSON はドメイン型にならない", () => {
  it("petId がない JSON は err になる", () => {
    expect(parseExamResult({ examId: EXAM_ID, items: [] }).isErr()).toBe(true);
  });
});

describe("Step 2: 電話番号とメールはログへ出ない", () => {
  it("JSON と util.inspect のどちらも値をマスクする", () => {
    const contact = parseOwnerContact(VALID_CONTACT)._unsafeUnwrap();
    expect(JSON.stringify(contact)).not.toContain(VALID_CONTACT.ownerName);
    expect(JSON.stringify(contact)).not.toContain(VALID_CONTACT.ownerEmail);
    expect(JSON.stringify(contact)).not.toContain(VALID_CONTACT.ownerPhone);
    expect(inspect(contact)).toContain("[REDACTED]");
    expect(inspect(contact)).not.toContain(VALID_CONTACT.ownerName);
    expect(inspect(contact)).not.toContain(VALID_CONTACT.ownerEmail);
    expect(inspect(contact)).not.toContain(VALID_CONTACT.ownerPhone);
    expect(contact.ownerName.toString()).toBe("[REDACTED]");
    expect(contact.ownerEmail.toString()).toBe("[REDACTED]");
    expect(contact.ownerPhone.toString()).toBe("[REDACTED]");
  });
});

describe("回帰条件: schema とドメイン型がずれない", () => {
  it("schema が返す値をそのまま OwnerContact として使える", () => {
    expectTypeOf(parseOwnerContact(VALID_CONTACT)._unsafeUnwrap()).toMatchTypeOf<OwnerContact>();
  });
});

describe("回帰条件: 異なる種類の ID はコンパイルで止まる", () => {
  it("OwnerId を PetId の位置へ渡せない", () => {
    expect(compileTypeFixture("s3-owner-id-is-not-pet-id.ts")).toEqual([]);
  });
});
