import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";

const BookingKindSchema = z.enum(["Reserved", "WalkIn"]);

export type BookingKind = z.infer<typeof BookingKindSchema>;

export const BookingKind = {
  schema: BookingKindSchema,
  parse: schemaResult(BookingKindSchema),
} as const;
