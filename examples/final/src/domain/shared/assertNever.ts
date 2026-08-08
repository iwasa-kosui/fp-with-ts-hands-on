export const assertNever = (_value: never): never => {
  throw new TypeError("Unreachable discriminated union variant");
};
