import type { SessionTokenHash } from "./sessionTokenHash.js";
import type { SessionTokenPlaintext } from "./sessionTokenPlaintext.js";

export type SessionToken = Readonly<{
  plaintext: SessionTokenPlaintext;
  hash: SessionTokenHash;
}>;

export type SessionTokenGenerator = Readonly<{
  generate: () => SessionToken;
}>;
