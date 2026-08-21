import { z } from "zod";

const schema = z.string().uuid();

export type OwnerId = z.infer<typeof schema>;
export const OwnerId = { schema, parse: schema.parse } as const;
