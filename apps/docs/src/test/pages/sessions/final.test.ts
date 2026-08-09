import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readPage = (slug: string): string =>
  readFileSync(
    new URL("../../../pages/sessions/" + slug + ".astro", import.meta.url),
    "utf8",
  );

describe("Final application", () => {
  it("documents the runnable clinic flow and the safeguards behind it", () => {
    const page = readPage("final");

    expect(page).toContain("examples/final");
    expect(page).toContain('id="final-structure"');
    expect(page).toContain('id="final-flow"');
    expect(page).toContain('id="final-operations"');
    expect(page).toContain('id="final-persistence"');
    expect(page).toContain('id="final-verify"');
    expect(page).toContain("domain");
    expect(page).toContain("adaptor/primary");
    expect(page).toContain("adaptor/secondary");
    expect(page).toContain("useCase");
    expect(page).toContain("app.ts");
    expect(page).toContain("StartExaminationUseCase");
    expect(page).toContain("ResultAsync");
    expect(page).toContain("resolveById");
    expect(page).toContain("persistDomainEvent(tx, event)");
    expect(page).toContain("Drizzle");
    expect(page).toContain("transaction");
    expect(page).toContain("clinic.sqlite");
    expect(page).toContain("/setup");
    expect(page).toContain("/login");
    expect(page).toContain("Admin");
    expect(page).toContain("Receptionist");
    expect(page).toContain("Veterinarian");
    expect(page).toContain(
      "Scheduled → CheckedIn → InExamination → AwaitingPayment → Paid",
    );
    expect(page).toContain("予約カレンダー");
    expect(page).toContain("受付ボード");
    expect(page).toContain("担当獣医師の重複");
    expect(page).toContain("前受金");
    expect(page).toContain("差額精算");
    expect(page).toContain("ExaminationCompletionStore");
    expect(page).toContain("AppointmentExaminationCompleted");
    expect(page).toContain("監査履歴から現在状態を復元しません");
    expect(page).toContain("EventHistoryReader");
    expect(page).toContain("Node v25.4.0");
    expect(page).toContain("Node.js 20 ではローカル実行していません");
    expect(page).toContain("Admin capability");
    expect(page).toContain("domain_event_sensitive_payloads");
    expect(page).toContain("機微情報の閲覧自体を監査");
    expect(page).not.toContain("SanitizedAuditRecord");
    expect(page).not.toContain("PII の非表示");
    expect(page).toContain("dist/app.js");
    expect(page).toContain("NODE_ENV を指定せず");
    expect(page).toContain("isProduction: true");
    expect(page).toContain("IdentityGenerationFailed");
    expect(page).toContain("pnpm --filter @fp-with-ts/clinic-final dev");
    expect(page).toContain("pnpm --filter @fp-with-ts/clinic-final build");
    expect(page).toContain(
      "pnpm --filter @fp-with-ts/clinic-final typecheck",
    );
    expect(page).toContain("pnpm --filter @fp-with-ts/clinic-final test");
  });
});
