import { z } from "zod";

export const PetIdBrand = Symbol();

const PetIdSchema = z.string().uuid().brand<typeof PetIdBrand>();

export type PetId = z.infer<typeof PetIdSchema>;

export const PetId = {
  schema: PetIdSchema,
  safeParse: (raw: unknown) => PetIdSchema.safeParse(raw),
} as const;
