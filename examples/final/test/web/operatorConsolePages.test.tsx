import { Link } from "@inertiajs/react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";

import Layout from "../../src/adaptor/primary/web/pages/Layout.js";
import { UserId } from "../../src/domain/user/userId.js";

const adminId = UserId.schema.parse(
  "76000000-0000-4000-8000-000000000001",
);

describe("Operator Console shell", () => {
  test("renders the administrator workspace with its current location and page action", () => {
    const html = renderToString(
      <Layout
        activeNavigation="dashboard"
        actions={<Link href="/appointments/new">新しい予約</Link>}
        description="現在の業務状況を確認します。"
        title="ダッシュボード"
        user={{ userId: adminId, role: "Admin" }}
      >
        <p>content</p>
      </Layout>,
    );

    expect(html).toContain('aria-label="アプリケーションサイドバー"');
    expect(html).toContain('aria-label="メインナビゲーション"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="/events"');
    expect(html).toContain('href="/users"');
    expect(html).toContain("新しい予約");
    expect(html).not.toContain("iconify");
    expect(html).not.toContain("fonts.googleapis.com");
  });

  test("keeps only veterinarian-available destinations named in the navigation", () => {
    const html = renderToString(
      <Layout
        activeNavigation="appointments"
        title="予約一覧"
        user={{ userId: adminId, role: "Veterinarian" }}
      >
        <p>content</p>
      </Layout>,
    );

    expect(html).toContain('aria-label="アプリケーションサイドバー"');
    expect(html).toContain('href="/appointments"');
    expect(html).toContain('aria-label="予約"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('href="/owners"');
    expect(html).not.toContain('href="/follow-ups"');
    expect(html).not.toContain('href="/users"');
    expect(html).not.toContain('href="/events"');
  });

  test("keeps receptionist operational destinations available without administrative destinations", () => {
    const html = renderToString(
      <Layout
        activeNavigation="follow-ups"
        title="フォローアップ"
        user={{ userId: adminId, role: "Receptionist" }}
      >
        <p>content</p>
      </Layout>,
    );

    expect(html).toContain('aria-label="メインナビゲーション"');
    expect(html).toContain('href="/appointments"');
    expect(html).toContain('href="/owners"');
    expect(html).toContain('href="/pets"');
    expect(html).toContain('href="/follow-ups"');
    expect(html).toContain('aria-label="フォローアップ"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('href="/users"');
    expect(html).not.toContain('href="/events"');
  });
});
