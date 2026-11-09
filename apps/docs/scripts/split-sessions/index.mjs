import { readdir } from "node:fs/promises";

const directory = new URL("./", import.meta.url);
const files = (await readdir(directory))
  .filter((name) => name.endsWith(".mjs") && name !== "index.mjs")
  .sort();

export const splitSessions = Object.fromEntries(
  await Promise.all(
    files.map(async (name) => [
      name.replace(/\.mjs$/, ""),
      (await import(new URL(name, directory).href)).default,
    ]),
  ),
);
