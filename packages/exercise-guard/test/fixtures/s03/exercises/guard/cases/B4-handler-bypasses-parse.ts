import type { Context } from "hono";

import type { StartExaminationInput } from "./G1-solution.js";

export const handle = async (
  c: Context,
  run: (input: StartExaminationInput) => unknown,
): Promise<Readonly<{ status: number }>> => {
  const body = await c.req.json();
  run(body);
  return { status: 200 };
};
