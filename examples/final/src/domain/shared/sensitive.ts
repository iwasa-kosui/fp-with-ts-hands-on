export type Sensitive<T> = Readonly<{
  unwrap: () => T;
  toJSON: () => string;
  toString: () => string;
}>;

const sensitiveMarker: unique symbol = Symbol("Sensitive");

export const Sensitive = {
  of: <T>(value: T): Sensitive<T> => {
    const sensitive = {
      unwrap: () => value,
      toJSON: () => "[REDACTED]",
      toString: () => "[REDACTED]",
      [Symbol.for("nodejs.util.inspect.custom")]: () => "[REDACTED]",
    };
    Object.defineProperty(sensitive, sensitiveMarker, {
      enumerable: false,
      value: true,
    });
    return sensitive;
  },
  is: (value: unknown): value is Sensitive<unknown> =>
    typeof value === "object" &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, sensitiveMarker) &&
    Reflect.get(value, sensitiveMarker) === true,
} as const;
