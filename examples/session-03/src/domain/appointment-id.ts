import { z } from "zod";

export const AppointmentIdBrand = Symbol();

const AppointmentIdSchema = z.string().uuid().brand<typeof AppointmentIdBrand>();

export type AppointmentId = z.infer<typeof AppointmentIdSchema>;

export const AppointmentId = {
  schema: AppointmentIdSchema,
  safeParse: (raw: unknown) => AppointmentIdSchema.safeParse(raw),
} as const;
