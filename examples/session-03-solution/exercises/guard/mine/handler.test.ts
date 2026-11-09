import fc from "fast-check";
import { describe, it } from "vitest";

import { handle } from "../subjects/handler.js";

const call = async (body: unknown) => {
  const seen: unknown[] = [];
  const context = { req: { json: async () => body } };
  await handle(context as never, (input) => {
    seen.push(input);
  }).catch(() => undefined);
  return seen;
};

describe("handle", () => {
  it("本文を渡したときの性質", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (id) => {
        const seen = await call({ appointmentId: id, veterinarianId: id });
        // ここに検証する性質を実装します
        return true;
      }),
      { numRuns: 30 },
    );
  });
});
