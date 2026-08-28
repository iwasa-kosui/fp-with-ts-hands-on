import { createApp } from "./app.js";

const app = createApp({ isProduction: import.meta.env.PROD });

export default app;
