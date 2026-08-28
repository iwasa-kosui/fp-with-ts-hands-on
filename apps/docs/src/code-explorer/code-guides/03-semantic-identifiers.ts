import type { CodeGuide } from "../code-guide";

export default [
  {
    id: "untyped-pet-id",
    title: "ペットの識別子が素の文字列のままになっている",
    currentDesign: "5種類の識別子のうち、AppointmentId・ExamId・VeterinarianId は branded 済みですが、PetId と OwnerId は uuid 検査だけで型が分かれていません。",
    futureRisk: "OwnerId を PetId の位置へ渡しても、どちらも string なのでコンパイルは通ります。",
    path: "src/domain/ids/petId.ts",
    highlights: [{ startLineNumber: 3, endLineNumber: 6 }],
  },
  {
    id: "plain-string-appointment-ids",
    title: "予約の6状態が識別子を string で持っている",
    currentDesign: "appointmentId・petId・ownerId が3つとも string で宣言されています。",
    futureRisk: "OwnerId を petId の位置へ渡すなど、用途の異なる識別子を入れても検出できません。",
    path: "src/domain/appointment/appointment.ts",
    highlights: [{ startLineNumber: 3, endLineNumber: 10 }],
  },
  {
    id: "empty-domain-type-tests",
    title: "通ってはいけない代入を検査する型テストがない",
    currentDesign: "domain.test-types.ts は空のままです。",
    futureRisk: "型で守れているつもりの箇所が、実際には守れていないと気付けません。",
    path: "src/domain/domain.test-types.ts",
    highlights: [{ startLineNumber: 1, endLineNumber: 1 }],
  },
] as const satisfies readonly CodeGuide[];
