export const logger = {
  info: (message: string, payload: unknown): void => {
    console.info(message, JSON.stringify(payload));
  },
};
