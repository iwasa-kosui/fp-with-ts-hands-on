import { inspect } from "node:util";

import { describe, expect, it } from "vitest";

import { OwnerContact } from "../src/domain/ownerContact.js";
import { OwnerId } from "../src/domain/ownerId.js";
import { PetId } from "../src/domain/petId.js";

describe("OwnerContact", () => {
  it("PII を JSON と文字列化から隠す", () => {
    const ownerId = OwnerId.schema.parse("33333333-3333-4333-8333-333333333333");
    const contact = OwnerContact.parse({ ownerId, ownerPhone: "090-0000-0000" })._unsafeUnwrap();

    expect(JSON.stringify(contact)).not.toContain("090-0000-0000");
    expect(String(contact.ownerPhone)).toBe("[REDACTED]");
    expect(inspect(contact.ownerPhone)).toBe("[REDACTED]");
  });

  it("値の意味を確認してから連絡先を組み立てる", () => {
    const petId = PetId.schema.parse("22222222-2222-4222-8222-222222222222");

    if (false) {
      // @ts-expect-error PetId cannot satisfy ownerId.
      OwnerContact.parse({ ownerId: petId, ownerPhone: "090-0000-0000" });
    }

    expect(petId).toBe("22222222-2222-4222-8222-222222222222");
  });
});
