import { z } from "zod";

const PetIdBrand = Symbol("PetId");
const PetIdSchema = z.string().regex(/^pet_[0-9]{3}$/).brand<typeof PetIdBrand>();
export type PetId = z.infer<typeof PetIdSchema>;

export const PetId: Readonly<{
  schema: typeof PetIdSchema;
  safeParse: (raw: unknown) => z.SafeParseReturnType<unknown, PetId>;
}> = {
  schema: PetIdSchema,
  safeParse: (raw) => PetIdSchema.safeParse(raw),
};
