import { inspect } from "node:util";
import { describe, expect, expectTypeOf, it } from "vitest";

import { parseExamResult } from "../../src/boundary/examResult.js";
import { parseOwnerContact, type OwnerContact } from "../../src/boundary/ownerContact.js";
import { compileTypeFixture } from "./compileTypeFixture.js";
import { clinicFixture } from "../../../fixtures/clinic.js";

const { examId: EXAM_ID, ownerContact: VALID_CONTACT } = clinicFixture;

describe("S3 regression: 境界と用途別 ID", () => {
  it("形の違う検査 JSON はドメイン型にならない", () => {
    expect(parseExamResult({ examId: EXAM_ID, items: [] }).isErr()).toBe(true);
  });

  it("電話番号とメールはログへ出ない", () => {
    const contact = parseOwnerContact(VALID_CONTACT)._unsafeUnwrap();
    expect(JSON.stringify(contact)).not.toContain(VALID_CONTACT.ownerEmail);
    expect(inspect(contact)).not.toContain(VALID_CONTACT.ownerPhone);
  });

  it("schema が返す値を OwnerContact として使える", () => {
    expectTypeOf(parseOwnerContact(VALID_CONTACT)._unsafeUnwrap()).toMatchTypeOf<OwnerContact>();
  });

  it("OwnerId を PetId の位置へ渡せない", () => {
    expect(compileTypeFixture("s3-owner-id-is-not-pet-id.ts")).toEqual([]);
  });

  it("境界値と配列は読み取り専用", () => {
    expect(compileTypeFixture("s3-exam-result-readonly.ts")).toEqual([]);
  });
});
