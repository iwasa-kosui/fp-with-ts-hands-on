const noop = (): void => undefined;

export const startMeasure = (name: string): (() => void) => {
  try {
    if (typeof performance === "undefined") return noop;
    const startMark = `${name}:start`;
    const endMark = `${name}:end`;
    performance.mark(startMark);
    return () => {
      try {
        performance.mark(endMark);
        performance.measure(name, startMark, endMark);
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
      } catch {
        return;
      }
    };
  } catch {
    return noop;
  }
};
