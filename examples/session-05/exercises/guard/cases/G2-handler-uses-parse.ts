import type { Context } from "hono";

import { StartExaminationInput } from "./G1-solution.js";

export const handle = async (
  c: Context,
  run: (input: StartExaminationInput) => unknown,
): Promise<Readonly<{ status: number }>> => {
  const input = StartExaminationInput.parse(await c.req.json())._unsafeUnwrap();
  run(input);
  return { status: 200 };
};
