import { z } from "zod";

const schema = z.string().uuid();

export type PetId = z.infer<typeof schema>;
export const PetId = { schema, parse: schema.parse } as const;
