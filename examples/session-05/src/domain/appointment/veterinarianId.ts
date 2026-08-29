import { z } from "zod";

const schema = z.string().uuid().brand<"VeterinarianId">();

export type VeterinarianId = z.infer<typeof schema>;
export const VeterinarianId = { schema, parse: schema.parse } as const;
