import { describe, expect, test, vi } from "vitest";

import { scryptPasswordHasher } from "../../src/adaptor/secondary/authentication/scryptPasswordHasher.js";
import { sessionTokenGenerator } from "../../src/adaptor/secondary/authentication/sessionToken.js";
import { Sensitive } from "../../src/domain/shared/sensitive.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";

describe("authentication adaptors", () => {
  test("hashes passwords with a random salt and verifies only the matching password", async () => {
    const password = Sensitive.of("correct horse battery staple");
    const hash = await scryptPasswordHasher.hash(password);

    expect(await scryptPasswordHasher.verify(password, hash)).toBe(true);
    expect(await scryptPasswordHasher.verify(Sensitive.of("incorrect password"), hash)).toBe(false);
    expect(JSON.stringify(hash)).toBe('"[REDACTED]"');
  });

  test("generates a cookie token while retaining only its hash for storage", () => {
    const token = sessionTokenGenerator.generate();

    expect(token.plaintext.unwrap()).toHaveLength(64);
    expect(token.hash.unwrap()).not.toBe(token.plaintext.unwrap());
    expect(JSON.stringify(token)).toBe('{"plaintext":"[REDACTED]","hash":"[REDACTED]"}');
  });

  test("rejects a large malformed sensitive password hash before decoding it", async () => {
    const password = Sensitive.of("correct horse battery staple");
    const malformedHash = Sensitive.of(`scrypt$${"A".repeat(10_000)}$invalid`);
    const validateHash = vi.spyOn(PasswordHash.schema, "safeParse");

    await expect(scryptPasswordHasher.verify(password, malformedHash)).resolves.toBe(false);
    expect(validateHash).toHaveBeenCalledWith(malformedHash.unwrap());
  });
});
