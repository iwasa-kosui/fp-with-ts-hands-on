import { inspect } from "node:util";

export type Sensitive<T> = Readonly<{
  unwrap: () => T;
  toJSON: () => string;
  toString: () => string;
  [inspect.custom]: () => string;
}>;

export const Sensitive = {
  of: <T>(value: T): Sensitive<T> => ({
    unwrap: () => value,
    toJSON: () => "[REDACTED]",
    toString: () => "[REDACTED]",
    [inspect.custom]: () => "[REDACTED]",
  }),
} as const;
