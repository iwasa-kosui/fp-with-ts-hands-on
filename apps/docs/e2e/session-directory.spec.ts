import { expect, test } from "@playwright/test";

const expectedSessions = [
  { title: "業務とシステムを引き継ぐ", href: "/sessions/00-system-handover/" },
  { title: "ビジネスイベントからワークフローを描く", href: "/sessions/01-business-events-and-workflows/" },
  { title: "予約の状態と遷移をモデル化する", href: "/sessions/02-state-transitions/" },
  { title: "用途の異なる識別子を型で区別する", href: "/sessions/03-semantic-identifiers/" },
  { title: "外部入力を境界で検証し個人情報を守る", href: "/sessions/04-boundaries-and-pii/" },
  { title: "失敗をワークフローの結果として扱う", href: "/sessions/05-workflow-errors/" },
  { title: "副作用と整合性境界を設計する", href: "/sessions/06-effects-and-consistency/" },
  { title: "参照実装で境界をたどる", href: "/sessions/final/" },
] as const;

test("session directory lists every session in curriculum order", async ({ page }) => {
  await page.goto("/sessions/");

  await expect(page.getByRole("heading", { level: 1, name: "セッション一覧" })).toBeVisible();
  const items = page.getByRole("list", { name: "セッション一覧" }).getByRole("listitem");
  await expect(items).toHaveCount(expectedSessions.length);

  for (const [index, expected] of expectedSessions.entries()) {
    const link = items.nth(index).getByRole("link");
    await expect(link).toHaveAttribute("href", expected.href);
    await expect(link.getByRole("heading", { name: expected.title })).toBeVisible();
  }
});
