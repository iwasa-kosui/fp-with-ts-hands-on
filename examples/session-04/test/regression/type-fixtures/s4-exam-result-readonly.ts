import { ExamResult } from "../../../src/boundary/examResult.js";
import { clinicFixture } from "../../../../fixtures/clinic.js";

const examResult = ExamResult.parse({
  examId: clinicFixture.examId,
  petId: clinicFixture.petId,
  items: ["skin scraping"],
})._unsafeUnwrap();

// @ts-expect-error 検査結果のプロパティは変更できません。
examResult.needsFollowUp = true;

// @ts-expect-error 検査項目は変更できません。
examResult.items.push("blood test");
