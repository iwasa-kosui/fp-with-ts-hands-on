import { z } from "zod";

const VeterinarianIdBrand = Symbol("VeterinarianId");
const VeterinarianIdSchema = z.string().regex(/^vet_[0-9]{3}$/).brand<typeof VeterinarianIdBrand>();
export type VeterinarianId = z.infer<typeof VeterinarianIdSchema>;

export const VeterinarianId: Readonly<{
  schema: typeof VeterinarianIdSchema;
  safeParse: (raw: unknown) => z.SafeParseReturnType<unknown, VeterinarianId>;
}> = {
  schema: VeterinarianIdSchema,
  safeParse: (raw) => VeterinarianIdSchema.safeParse(raw),
};
