import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/adaptor/secondary/sqlite/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: "./clinic.sqlite" },
});
