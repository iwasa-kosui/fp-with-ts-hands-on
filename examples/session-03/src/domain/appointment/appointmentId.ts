import { z } from "zod";

const schema = z.string().uuid().brand<"AppointmentId">();

export type AppointmentId = z.infer<typeof schema>;
export const AppointmentId = { schema, parse: schema.parse } as const;
