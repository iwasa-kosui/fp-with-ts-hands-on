import { describe, expect, test } from "vitest";

import { scryptPasswordHasher } from "../../src/adaptor/secondary/authentication/scryptPasswordHasher.js";
import { sessionTokenGenerator } from "../../src/adaptor/secondary/authentication/sessionToken.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import { PlaintextPassword } from "../../src/domain/user/plaintextPassword.js";

describe("authentication adaptors", () => {
  test("hashes passwords with a random salt and verifies only the matching password", async () => {
    const password = PlaintextPassword.schema.parse("correct horse battery staple");
    const hash = await scryptPasswordHasher.hash(password);

    expect(await scryptPasswordHasher.verify(password, hash)).toBe(true);
    expect(
      await scryptPasswordHasher.verify(
        PlaintextPassword.schema.parse("incorrect password"),
        hash,
      ),
    ).toBe(false);
    expect(JSON.stringify(hash)).toBe('"[REDACTED]"');
  });

  test("generates a cookie token while retaining only its hash for storage", () => {
    const token = sessionTokenGenerator.generate();

    expect(token.plaintext.unwrap()).toHaveLength(64);
    expect(token.hash.unwrap()).not.toBe(token.plaintext.unwrap());
    expect(JSON.stringify(token)).toBe('{"plaintext":"[REDACTED]","hash":"[REDACTED]"}');
  });

  test("rejects a large malformed hash at the schema boundary", () => {
    const malformedHash = PasswordHash.parse(
      `scrypt$${"A".repeat(10_000)}$invalid`,
    );

    expect(malformedHash.isErr()).toBe(true);
  });
});
