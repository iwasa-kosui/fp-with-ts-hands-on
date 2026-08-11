import { inspect } from "node:util";

import { expect, it } from "vitest";

import { OwnerContact } from "../src/domain/ownerContact.js";
import { OwnerId } from "../src/domain/ownerId.js";

it("飼い主の電話番号を文字列化しても出力しない", () => {
  const ownerId = OwnerId.schema.parse("33333333-3333-4333-8333-333333333333");
  const contact = OwnerContact.parse({ ownerId, ownerPhone: "090-0000-0000" })._unsafeUnwrap();

  expect(JSON.stringify(contact)).not.toContain("090-0000-0000");
  expect(String(contact.ownerPhone)).toBe("[REDACTED]");
  expect(inspect(contact.ownerPhone)).toBe("[REDACTED]");
});
