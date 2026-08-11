import { expect, it } from "vitest";

import { OwnerId, type OwnerId as OwnerIdValue } from "../src/domain/ownerId.js";
import { PetId } from "../src/domain/petId.js";

it("ペット ID を飼い主 ID として扱えない", () => {
  const petId = PetId.parse("22222222-2222-4222-8222-222222222222")._unsafeUnwrap();
  const ownerId = OwnerId.parse("33333333-3333-4333-8333-333333333333")._unsafeUnwrap();
  // @ts-expect-error PetId cannot satisfy OwnerId.
  const invalidOwnerId: OwnerIdValue = petId;

  expect(ownerId).toBe("33333333-3333-4333-8333-333333333333");
  void invalidOwnerId;
});
