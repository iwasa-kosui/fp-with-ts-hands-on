import { createHash, randomBytes } from "node:crypto";

import { SessionTokenHash } from "../../../domain/session/sessionTokenHash.js";
import { SessionTokenPlaintext } from "../../../domain/session/sessionTokenPlaintext.js";
import type { SessionTokenGenerator } from "../../../domain/session/sessionTokenGenerator.js";

const generate = () => {
  const plaintext = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(plaintext).digest("hex");

  return {
    plaintext: SessionTokenPlaintext.schema.parse(plaintext),
    hash: SessionTokenHash.schema.parse(hash),
  };
};

export const sessionTokenGenerator: SessionTokenGenerator = { generate };
