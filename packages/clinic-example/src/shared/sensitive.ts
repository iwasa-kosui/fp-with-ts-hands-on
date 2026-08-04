const REDACTED = "[REDACTED]";

export type Sensitive<T> = Readonly<{
  unwrap: () => T;
  toJSON: () => string;
  toString: () => string;
}>;

export const Sensitive: Readonly<{
  of: <T>(value: T) => Sensitive<T>;
}> = {
  of: <T>(value: T): Sensitive<T> => ({
    unwrap: () => value,
    toJSON: () => REDACTED,
    toString: () => REDACTED,
  }),
};
