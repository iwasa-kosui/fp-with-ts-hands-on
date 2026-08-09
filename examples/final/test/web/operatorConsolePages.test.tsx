import { Link } from "@inertiajs/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";

import Layout from "../../src/adaptor/primary/web/pages/Layout.js";
import Dashboard from "../../src/adaptor/primary/web/pages/Dashboard.js";
import Login from "../../src/adaptor/primary/web/pages/Login.js";
import Setup from "../../src/adaptor/primary/web/pages/Setup.js";
import { UserId } from "../../src/domain/user/userId.js";

const adminId = UserId.schema.parse(
  "76000000-0000-4000-8000-000000000001",
);

const renderPublicPage = (page: ReactElement): string =>
  renderToString(page);

describe("Operator Console shell", () => {
  test("renders the login form with labelled controls and accessible errors", () => {
    const loginHtml = renderPublicPage(
      <Login
        auth={{ user: null }}
        errors={{
          credentials: "メールアドレスまたはパスワードを確認してください。",
          email: "メールアドレスを確認してください。",
          password: "パスワードを確認してください。",
        }}
        flash={{}}
      />,
    );

    expect(loginHtml).toContain('aria-label="ログイン"');
    expect(loginHtml).toContain("関数型どうぶつ病院");
    expect(loginHtml).toContain('autoComplete="email"');
    expect(loginHtml).toContain('id="email"');
    expect(loginHtml).toContain('aria-describedby="email-error"');
    expect(loginHtml).toContain('aria-invalid="true"');
    expect(loginHtml).toContain('role="alert"');
    expect(loginHtml).toContain('id="password-error"');
  });

  test("renders the initial administrator form without authenticated navigation", () => {
    const setupHtml = renderPublicPage(
      <Setup
        auth={{ user: null }}
        errors={{
          email: "メールアドレスを確認してください。",
          name: "表示名を確認してください。",
          password: "パスワードを確認してください。",
        }}
        flash={{}}
      />,
    );

    expect(setupHtml).toContain("最初の管理者を登録");
    expect(setupHtml).toContain('aria-label="初期管理者登録"');
    expect(setupHtml).toContain('id="name"');
    expect(setupHtml).toContain('aria-describedby="name-error"');
    expect(setupHtml).toContain('aria-invalid="true"');
    expect(setupHtml).toContain('role="alert"');
    expect(setupHtml).not.toContain('aria-label="メインナビゲーション"');
  });

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

  test("shows the dashboard booking action only to operational booking roles", () => {
    const props = {
      activeAppointments: [],
      counts: { owners: 0, pets: 0, appointments: 0, activeAppointments: 0 },
      errors: {},
      flash: {},
    } as const;

    const administratorHtml = renderToString(
      <Dashboard
        {...props}
        auth={{ user: { userId: adminId, role: "Admin" } }}
      />,
    );
    const veterinarianHtml = renderToString(
      <Dashboard
        {...props}
        auth={{ user: { userId: adminId, role: "Veterinarian" } }}
      />,
    );

    expect(administratorHtml).toContain('href="/appointments/new"');
    expect(administratorHtml).toContain("新しい予約");
    expect(veterinarianHtml).not.toContain('href="/appointments/new"');
    expect(veterinarianHtml).not.toContain("新しい予約");
  });
});
