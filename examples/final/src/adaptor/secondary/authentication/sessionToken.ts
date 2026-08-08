import { createHash, randomBytes } from "node:crypto";

import { Sensitive } from "../../../domain/shared/sensitive.js";
import { SessionTokenHash } from "../../../domain/session/sessionTokenHash.js";
import type { SessionTokenGenerator } from "../../../domain/session/sessionTokenGenerator.js";

const generate = () => {
  const plaintext = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(plaintext).digest("hex");

  return {
    plaintext: Sensitive.of(plaintext),
    hash: SessionTokenHash.schema.parse(hash),
  };
};

export const sessionTokenGenerator: SessionTokenGenerator = { generate };
