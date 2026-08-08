import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

import { PasswordHash } from "../../../domain/user/passwordHash.js";
import type { PasswordHasher } from "../../../domain/user/passwordHasher.js";

const saltLength = 16;
const derivedKeyLength = 64;

const deriveKey = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(password, salt, derivedKeyLength, (error, derivedKey) => {
      if (error !== null) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });

const hash = async (password: Parameters<PasswordHasher["hash"]>[0]) => {
  const salt = randomBytes(saltLength);
  const derivedKey = await deriveKey(password.unwrap(), salt);

  return PasswordHash.schema.parse(
    `scrypt$${salt.toString("base64")}$${derivedKey.toString("base64")}`,
  );
};

const verify = async (
  password: Parameters<PasswordHasher["verify"]>[0],
  passwordHash: Parameters<PasswordHasher["verify"]>[1],
): Promise<boolean> => {
  const [algorithm, encodedSalt, encodedKey] = passwordHash.unwrap().split("$");

  if (algorithm !== "scrypt" || encodedSalt === undefined || encodedKey === undefined) {
    return false;
  }

  const expectedKey = Buffer.from(encodedKey, "base64");
  const salt = Buffer.from(encodedSalt, "base64");

  if (expectedKey.length !== derivedKeyLength || salt.length !== saltLength) {
    return false;
  }

  const derivedKey = await deriveKey(password.unwrap(), salt);

  return timingSafeEqual(derivedKey, expectedKey);
};

export const scryptPasswordHasher: PasswordHasher = { hash, verify };
