import type { EventContext } from "../aggregate/eventContext.js";
import type { Timestamp } from "../aggregate/timestamp.js";
import type { UserId } from "../user/userId.js";
import { createSessionCreated, createSessionDeleted, type SessionCreated, type SessionDeleted } from "./sessionEvent.js";
import type { SessionId } from "./sessionId.js";
import type { SessionTokenHash } from "./sessionTokenHash.js";

export type Session = Readonly<{
  sessionId: SessionId;
  userId: UserId;
  tokenHash: SessionTokenHash;
  expiresAt: Timestamp;
}>;

const create = (context: EventContext) => (session: Session): SessionCreated =>
  createSessionCreated(context, session);

const remove = (context: EventContext) => (session: Session): SessionDeleted =>
  createSessionDeleted(context, session);

export const Session = {
  create,
  delete: remove,
} as const;
