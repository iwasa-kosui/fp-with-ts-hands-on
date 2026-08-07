const inspectSymbol = Symbol.for("nodejs.util.inspect.custom");

export type Sensitive<T> = Readonly<{
  unwrap: () => T;
  toJSON: () => string;
  toString: () => string;
  [inspectSymbol]: () => string;
}>;

export const Sensitive = {
  of: <T>(value: T): Sensitive<T> => ({
    unwrap: () => value,
    toJSON: () => "[REDACTED]",
    toString: () => "[REDACTED]",
    [inspectSymbol]: () => "[REDACTED]",
  }),
} as const;
