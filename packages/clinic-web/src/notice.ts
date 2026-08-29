import type { Context } from "hono";

import type { Notice } from "./contracts.js";

const noticesByCode: Readonly<Record<string, Exclude<Notice, null>>> = {
  "not-implemented": { kind: "FeatureNotImplemented" },
  "invalid-state": { kind: "InvalidAppointmentState" },
  "not-found": { kind: "AppointmentNotFound" },
  conflict: { kind: "AppointmentConflict" },
};

export const noticeFromCode = (raw: string | undefined): Notice =>
  raw === undefined ? null : (noticesByCode[raw] ?? null);

export const notImplemented = (context: Context): Response =>
  context.redirect("/?notice=not-implemented", 303);
