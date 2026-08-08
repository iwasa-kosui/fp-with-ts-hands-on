import type { EventContext } from "../aggregate/eventContext.js";
import type { Timestamp } from "../aggregate/timestamp.js";
import type { UserId } from "../user/userId.js";
import { SessionEvent, type SessionCreated, type SessionDeleted } from "./sessionEvent.js";
import type { SessionId } from "./sessionId.js";
import type { SessionTokenHash } from "./sessionTokenHash.js";

export type Session = Readonly<{
  sessionId: SessionId;
  userId: UserId;
  tokenHash: SessionTokenHash;
  expiresAt: Timestamp;
}>;

const create = (context: EventContext) => (session: Session): SessionCreated =>
  SessionEvent.create(
    context,
    session.sessionId,
    session,
    "SessionCreated",
    "session.created",
    { sessionId: session.sessionId, userId: session.userId },
  );

const remove = (context: EventContext) => (session: Session): SessionDeleted =>
  SessionEvent.create(
    context,
    session.sessionId,
    undefined,
    "SessionDeleted",
    "session.deleted",
    { sessionId: session.sessionId, userId: session.userId },
  );

export const Session = {
  create,
  delete: remove,
} as const;
