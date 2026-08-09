import type { PasswordHash } from "./passwordHash.js";
import type { PlaintextPassword } from "./plaintextPassword.js";

export type { PlaintextPassword } from "./plaintextPassword.js";

export type PasswordHasher = Readonly<{
  hash: (password: PlaintextPassword) => Promise<PasswordHash>;
  verify: (password: PlaintextPassword, hash: PasswordHash) => Promise<boolean>;
}>;
