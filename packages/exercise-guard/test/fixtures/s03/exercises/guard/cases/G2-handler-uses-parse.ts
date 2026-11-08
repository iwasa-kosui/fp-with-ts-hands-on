import type { Context } from "hono";

import { StartExaminationInput } from "./G1-solution.js";

export const handle = async (
  c: Context,
  run: (input: StartExaminationInput) => unknown,
): Promise<Readonly<{ status: number }>> => {
  const parsed = StartExaminationInput.parse(await c.req.json());
  if (parsed.isErr()) {
    return { status: 400 };
  }
  run(parsed._unsafeUnwrap());
  return { status: 200 };
};
