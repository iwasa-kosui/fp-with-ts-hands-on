import type { Sensitive } from "../shared/sensitive.js";
import type { SessionTokenHash } from "./sessionTokenHash.js";

export type SessionToken = Readonly<{
  plaintext: Sensitive<string>;
  hash: SessionTokenHash;
}>;

export type SessionTokenGenerator = Readonly<{
  generate: () => SessionToken;
}>;
