import type { Timestamp } from "./timestamp.js";

export type Clock = Readonly<{
  now: () => Timestamp;
}>;
