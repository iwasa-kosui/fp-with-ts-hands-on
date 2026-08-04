import { z } from "zod";
import { Sensitive, type Sensitive as SensitiveValue } from "../shared/sensitive.js";

const sensitiveString = z.string().min(1).transform(Sensitive.of);
const OwnerContactSchema = z.object({
  ownerName: sensitiveString,
  ownerEmail: z.string().email().transform(Sensitive.of),
  ownerPhone: sensitiveString,
});

export type OwnerContact = Readonly<{
  ownerName: SensitiveValue<string>;
  ownerEmail: SensitiveValue<string>;
  ownerPhone: SensitiveValue<string>;
}>;

export const OwnerContact: Readonly<{
  schema: typeof OwnerContactSchema;
  safeParse: (raw: unknown) => z.SafeParseReturnType<unknown, OwnerContact>;
}> = {
  schema: OwnerContactSchema,
  safeParse: (raw) => OwnerContactSchema.safeParse(raw),
};
