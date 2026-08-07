import { z } from "zod";

export const VeterinarianIdBrand = Symbol();

const VeterinarianIdSchema = z.string().uuid().brand<typeof VeterinarianIdBrand>();

export type VeterinarianId = z.infer<typeof VeterinarianIdSchema>;

export const VeterinarianId = {
  schema: VeterinarianIdSchema,
  safeParse: (raw: unknown) => VeterinarianIdSchema.safeParse(raw),
} as const;
