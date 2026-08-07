import { expect, it } from "vitest";

const rawExamResult = {
  examId: "77777777-7777-4777-8777-777777777777",
  petId: "22222222-2222-4222-8222-222222222222",
  collectedAt: "2026-08-30T06:50:00.000Z",
  needsFollowUp: true,
  items: ["skin scraping"],
};
const rawOwnerContact = {
  ownerName: "Owner A",
  ownerEmail: "owner@example.test",
  ownerPhone: "090-0000-0000",
};

it("外部検査 payload を検証し、連絡先はログで伏せる", async () => {
  const [{ ExamResult }, { OwnerContact }] = await Promise.all([
    import("../src/boundary/exam-result.js"),
    import("../src/boundary/owner-contact.js"),
  ]);
  const exam = ExamResult.safeParse(rawExamResult);
  const contact = OwnerContact.safeParse(rawOwnerContact);

  expect(exam.success).toBe(true);
  expect(contact.success).toBe(true);
  expect(JSON.stringify(contact.success ? contact.data : null)).toContain("[REDACTED]");
  expect(JSON.stringify(contact.success ? contact.data : null)).not.toContain("owner@example.test");
});
