import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";

const UserIdSchema = z.string().uuid().brand<"UserId">();

export type UserId = z.output<typeof UserIdSchema>;

export const UserId = {
  schema: UserIdSchema,
  parse: schemaResult(UserIdSchema),
} as const;
