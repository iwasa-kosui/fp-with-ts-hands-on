import type { Sensitive } from "../shared/sensitive.js";
import type { PasswordHash } from "./passwordHash.js";

export type PlaintextPassword = Sensitive<string>;

export type PasswordHasher = Readonly<{
  hash: (password: PlaintextPassword) => Promise<PasswordHash>;
  verify: (password: PlaintextPassword, hash: PasswordHash) => Promise<boolean>;
}>;
