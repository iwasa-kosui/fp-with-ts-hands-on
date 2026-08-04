export const logger: Readonly<{
  info: (message: string, payload?: unknown) => void;
}> = {
  info: (message, payload) => {
    if (payload === undefined) {
      console.log(`[INFO] ${message}`);
      return;
    }
    console.log(`[INFO] ${message}`, JSON.stringify(payload));
  },
};
