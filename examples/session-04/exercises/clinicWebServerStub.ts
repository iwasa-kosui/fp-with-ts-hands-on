import type { Context } from "hono";

export const noticeFromCode = (): undefined => undefined;

export const notImplemented = (context: Context): Response =>
  context.text("Not Implemented", 501);
