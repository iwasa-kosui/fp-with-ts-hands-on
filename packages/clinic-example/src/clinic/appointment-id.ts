import { z } from "zod";

const AppointmentIdBrand = Symbol("AppointmentId");
const AppointmentIdSchema = z.string().regex(/^appt_[0-9]{3}$/).brand<typeof AppointmentIdBrand>();
export type AppointmentId = z.infer<typeof AppointmentIdSchema>;

export const AppointmentId: Readonly<{
  schema: typeof AppointmentIdSchema;
  safeParse: (raw: unknown) => z.SafeParseReturnType<unknown, AppointmentId>;
}> = {
  schema: AppointmentIdSchema,
  safeParse: (raw) => AppointmentIdSchema.safeParse(raw),
};
