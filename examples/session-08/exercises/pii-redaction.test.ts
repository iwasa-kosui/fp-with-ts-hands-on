import { expect, it } from "vitest";

it("飼い主の電話番号を文字列化しても出力しない", () => {
  const contact = {
    ownerId: "33333333-3333-4333-8333-333333333333",
    ownerPhone: "090-0000-0000",
  };

  expect(JSON.stringify(contact)).not.toContain("090-0000-0000");
});
