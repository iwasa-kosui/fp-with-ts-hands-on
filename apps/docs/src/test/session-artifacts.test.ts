import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { sessions } from "../sessions/catalog";

const readRepositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), "../..", path), "utf8");

const incrementalSessions = sessions.filter(
  (session) => session.sequence !== "Final",
);

describe("incremental session artifacts", () => {
  it("uses catalog-correct titles and a consistent learning-loop heading order", () => {
    for (const session of incrementalSessions) {
      const readme = readRepositoryFile(`examples/${session.snapshot}/README.md`);
      const title = `# Session ${session.sequence}: ${session.title}`;
      const headings = [
        "## 開始状態",
        "## この回で変える関数",
        "## 検証",
        "## 次の snapshot",
      ];

      expect(readme, session.slug).toContain(title);
      let previousIndex = -1;
      for (const heading of headings) {
        const index = readme.indexOf(heading);
        expect(index, `${session.slug}: ${heading}`).toBeGreaterThan(previousIndex);
        previousIndex = index;
      }
    }
  });

  it("does not place follow-up request timing in appointment cancellation state", () => {
    for (let session = 6; session <= 13; session += 1) {
      const appointment = readRepositoryFile(
        `examples/session-${String(session).padStart(2, "0")}/src/domain/appointment.ts`,
      );

      expect(appointment, `session-${session}`).not.toContain("followUpRequestedAt");
    }
  });

  it("describes Session 13 as a local endpoint and Final as a read-only comparison", () => {
    const readme = readRepositoryFile("examples/session-13/README.md");

    expect(readme).toContain("この Session 内で演習を green にします");
    expect(readme).toContain("read-only の比較");
    expect(readme).toContain("source-compatible ではありません");
  });

  it("directs Session 07 participants to the existing owner and pet brand schemas", () => {
    const readme = readRepositoryFile("examples/session-07/README.md");
    const page = readRepositoryFile(
      "apps/docs/src/pages/sessions/07-meaningful-values.astro",
    );

    expect(readme).toContain("unused @ts-expect-error");
    expect(readme).toContain("PetId");
    expect(readme).not.toContain("演習は PII の出力保護");
    expect(page).toContain("OwnerIdSchema");
    expect(page).toContain("PetIdSchema");
    expect(page).toContain("unused `@ts-expect-error`");
    expect(page).not.toContain("AppointmentId.parse");
  });

  it("keeps Session 06 editing scope to parse and presents schemaResult as support", () => {
    const page = readRepositoryFile(
      "apps/docs/src/pages/sessions/06-input-boundary.astro",
    );

    expect(page).toContain("src/domain/shared/schemaResult.ts");
    expect(page).toContain("src/domain/startExaminationInput.ts");
    expect(page).toContain("提供済みの支援");
    expect(page).toContain("StartExaminationInput.parse</code> の1関数だけ");
    expect(page).not.toContain("schemaResult</code> と <code>StartExaminationInput.parse</code> の2関数");
  });

  it("explains each early RED with the contract the next snapshot supplies", () => {
    const session01 = readRepositoryFile(
      "apps/docs/src/pages/sessions/01-invariants.astro",
    );
    const session03 = readRepositoryFile("examples/session-03/README.md");
    const session04 = readRepositoryFile("examples/session-04/README.md");

    expect(session01).toContain("会計済みの来院を終端状態として扱う");
    expect(session01).toContain("Session 02 で提供されます");
    expect(session01).toContain(
      'phase="green" command="pnpm --filter @fp-with-ts/clinic-session-02 test -- state-modeling.test.ts"',
    );
    expect(session01).not.toContain("AwaitingPayment を含む状態一覧");
    expect(session03).toContain("`startExamination` がまだないため");
    expect(session03).not.toContain("会計待ちがまだないため");
    expect(session04).toContain("`AwaitingPayment` への遷移がまだないため");
    expect(session04).not.toContain("キャンセル状態がまだないため");
  });

  it("limits Session 02 participant work to the missing check-in transition", () => {
    const page = readRepositoryFile(
      "apps/docs/src/pages/sessions/02-state-vocabulary.astro",
    );
    const readme = readRepositoryFile("examples/session-02/README.md");
    const exercise = readRepositoryFile(
      "examples/session-02/exercises/state-vocabulary.test.ts",
    );

    expect(page).toContain("<code>Appointment.book</code> は提供済み");
    expect(page).toContain("<code>Appointment.checkIn</code> の1関数だけ");
    expect(page).toContain("提供済みの予約を CheckedIn へ遷移する checkIn がまだなく");
    expect(readme).toContain("`Appointment.book` は提供済み");
    expect(readme).toContain("`Appointment.checkIn` の1関数だけ");
    expect(exercise).toContain("Scheduled を CheckedIn へ遷移");
  });
});
