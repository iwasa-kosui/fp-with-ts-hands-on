import { Link } from "@inertiajs/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";

import Layout from "../../src/adaptor/primary/web/pages/Layout.js";
import AppointmentNew, {
  toAppointmentTimestamp,
} from "../../src/adaptor/primary/web/pages/Appointments/New.js";
import AppointmentShow from "../../src/adaptor/primary/web/pages/Appointments/Show.js";
import Dashboard from "../../src/adaptor/primary/web/pages/Dashboard.js";
import EventsIndex from "../../src/adaptor/primary/web/pages/Events/Index.js";
import FollowUpsIndex from "../../src/adaptor/primary/web/pages/FollowUps/Index.js";
import Login from "../../src/adaptor/primary/web/pages/Login.js";
import Setup from "../../src/adaptor/primary/web/pages/Setup.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { PetId } from "../../src/domain/pet/petId.js";
import { UserId } from "../../src/domain/user/userId.js";

const adminId = UserId.schema.parse(
  "76000000-0000-4000-8000-000000000001",
);

const renderPublicPage = (page: ReactElement): string =>
  renderToString(page);

const ownerId = OwnerId.schema.parse("73000000-0000-4000-8000-000000000001");
const petId = PetId.schema.parse("74000000-0000-4000-8000-000000000001");
const appointmentId = AppointmentId.schema.parse("75000000-0000-4000-8000-000000000001");
const scheduledAt = Timestamp.schema.parse("2026-08-10T03:00:00.000Z");

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
    expect(loginHtml).toContain('aria-live="polite"');
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
    expect(html).toContain('aria-controls="app-navigation"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('id="app-navigation"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('title="ダッシュボード"');
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

  test("does not render a dashboard booking action without a server-projected capability", () => {
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

    expect(administratorHtml).not.toContain('href="/appointments/new"');
    expect(administratorHtml).not.toContain("新しい予約");
    expect(veterinarianHtml).not.toContain('href="/appointments/new"');
    expect(veterinarianHtml).not.toContain("新しい予約");
  });

  test("renders booking as an accessible form with a route back to the appointment list", () => {
    const html = renderPublicPage(
      <AppointmentNew
        auth={{ user: { userId: adminId, role: "Receptionist" } }}
        errors={{ reason: "来院理由を確認してください。" }}
        flash={{}}
        owners={[{ ownerId, name: "Hanako Owner" }]}
        pets={[{ ownerId, petId, name: "Mugi" }]}
      />,
    );

    expect(html).toContain('aria-label="予約登録"');
    expect(html).toContain('href="/appointments"');
    expect(html).toContain('name="scheduledAt"');
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain('aria-describedby="reason-error"');
  });

  test("converts a picked local appointment time to the timestamp accepted by booking", () => {
    const timestamp = toAppointmentTimestamp("2026-08-10T12:34");
    const roundTrip = new Date(timestamp);

    expect(Timestamp.schema.safeParse(timestamp).success).toBe(true);
    expect([
      roundTrip.getFullYear(),
      roundTrip.getMonth() + 1,
      roundTrip.getDate(),
      roundTrip.getHours(),
      roundTrip.getMinutes(),
    ]).toEqual([2026, 8, 10, 12, 34]);
    expect(toAppointmentTimestamp("")).toBe("");
  });

  test("renders only the server-authorized state workflow actions", () => {
    const awaitingPaymentHtml = renderPublicPage(
      <AppointmentShow
        actions={{
          cancel: false,
          checkIn: false,
          recordExamResult: false,
          recordPayment: true,
          startExamination: false,
        }}
        appointment={{
          appointmentId,
          checkedInAt: Timestamp.schema.parse("2026-08-10T03:10:00.000Z"),
          examId: "71000000-0000-4000-8000-000000000030",
          examinationCompletedAt: Timestamp.schema.parse("2026-08-10T03:30:00.000Z"),
          examinationStartedAt: Timestamp.schema.parse("2026-08-10T03:20:00.000Z"),
          kind: "AwaitingPayment",
          ownerId,
          ownerName: "Hanako Owner",
          petId,
          petName: "Mugi",
          scheduledAt,
          veterinarianId: "77000000-0000-4000-8000-000000000001",
          veterinarianName: "Clinic Vet",
        }}
        auth={{ user: { userId: adminId, role: "Receptionist" } }}
        errors={{}}
        flash={{}}
        veterinarianId={null}
      />,
    );
    const scheduledHtml = renderPublicPage(
      <AppointmentShow
        actions={{
          cancel: true,
          checkIn: true,
          recordExamResult: false,
          recordPayment: false,
          startExamination: false,
        }}
        appointment={{
          appointmentId,
          kind: "Scheduled",
          ownerId,
          ownerName: "Hanako Owner",
          petId,
          petName: "Mugi",
          scheduledAt,
        }}
        auth={{ user: { userId: adminId, role: "Receptionist" } }}
        errors={{}}
        flash={{}}
        veterinarianId={null}
      />,
    );

    expect(awaitingPaymentHtml).toContain('aria-label="予約情報"');
    expect(awaitingPaymentHtml).toContain('aria-label="現在の操作"');
    expect(awaitingPaymentHtml).toContain("会計待ち");
    expect(awaitingPaymentHtml).toContain("会計を記録");
    expect(awaitingPaymentHtml).not.toContain("診察結果を記録");
    expect(scheduledHtml).toContain("受付する");
    expect(scheduledHtml).toContain("予約をキャンセル");
    expect(scheduledHtml).not.toContain("会計を記録");
  });

  test("renders an action that the server authorizes even when the state does not imply it", () => {
    const html = renderPublicPage(
      <AppointmentShow
        actions={{
          cancel: false,
          checkIn: false,
          recordExamResult: false,
          recordPayment: true,
          startExamination: false,
        }}
        appointment={{
          appointmentId,
          kind: "Scheduled",
          ownerId,
          ownerName: "Hanako Owner",
          petId,
          petName: "Mugi",
          scheduledAt,
        }}
        auth={{ user: { userId: adminId, role: "Receptionist" } }}
        errors={{}}
        flash={{}}
        veterinarianId={null}
      />,
    );

    expect(html).toContain('aria-label="現在の操作"');
    expect(html).toContain("会計を記録");
    expect(html).not.toContain("受付する");
    expect(html).not.toContain("予約をキャンセル");
    expect(html).not.toContain("診察を開始");
    expect(html).not.toContain("診察結果を記録");
  });

  test("renders no action form when the server authorizes no actions", () => {
    const html = renderPublicPage(
      <AppointmentShow
        actions={{
          cancel: false,
          checkIn: false,
          recordExamResult: false,
          recordPayment: false,
          startExamination: false,
        }}
        appointment={{
          appointmentId,
          kind: "Scheduled",
          ownerId,
          ownerName: "Hanako Owner",
          petId,
          petName: "Mugi",
          scheduledAt,
        }}
        auth={{ user: { userId: adminId, role: "Receptionist" } }}
        errors={{}}
        flash={{}}
        veterinarianId={null}
      />,
    );

    expect(html).toContain('aria-label="現在の操作"');
    expect(html).toContain("現在実行できる操作はありません");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("受付する");
    expect(html).not.toContain("予約をキャンセル");
    expect(html).not.toContain("診察を開始");
    expect(html).not.toContain("診察結果を記録");
    expect(html).not.toContain("会計を記録");
  });

  test("renders follow-up selection with its initial disabled batch action", () => {
    const html = renderPublicPage(
      <FollowUpsIndex
        auth={{ user: { userId: adminId, role: "Receptionist" } }}
        errors={{}}
        flash={{}}
        followUps={[
          {
            appointmentId,
            ownerName: "Hanako Owner",
            ownerPhone: "090-1234-5678",
            petId,
            requested: false,
          },
          {
            appointmentId: AppointmentId.schema.parse("75000000-0000-4000-8000-000000000002"),
            ownerName: "Taro Owner",
            ownerPhone: "080-1234-5678",
            petId,
            requested: true,
          },
        ]}
      />,
    );

    expect(html).toContain('aria-label="フォローアップ対象"');
    expect(html).toContain('aria-label="フォローアップの一括操作"');
    expect(html).toContain("0件を選択中");
    expect(html).toContain("未依頼");
    expect(html).toContain("依頼済み");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>フォローアップを依頼<\/button>/);
    expect(html).toContain('name="appointmentIds"');
  });

  test("renders a sensitive known audit event as summary-only data", () => {
    const html = renderPublicPage(
      <EventsIndex
        auth={{ user: { userId: adminId, role: "Admin" } }}
        errors={{}}
        flash={{}}
        events={[{
          actorUserId: adminId,
          aggregateId: appointmentId,
          aggregateName: "Appointment",
          eventId: EventId.schema.parse("78000000-0000-4000-8000-000000000001"),
          eventName: "appointment.payment-recorded",
          occurredAt: Timestamp.schema.parse("2026-08-09T03:00:00.000Z"),
          payloadSensitivity: "Sensitive",
        }]}
      />,
    );

    expect(html).toContain('aria-label="監査イベント一覧"');
    expect(html).toContain('role="status"');
    expect(html).toContain("監査履歴には個人情報を表示しません");
    expect(html).toContain("78000000-0000-4000-8000-000000000001");
    expect(html).toContain("会計を記録");
    expect(html).toContain("機微情報を含みます");
    expect(html).toContain("76000000-0000-4000-8000-000000000001");
    expect(html).toContain("Appointment");
    expect(html).toContain("75000000-0000-4000-8000-000000000001");
    expect(html).not.toContain("<dl");
    expect(html).not.toContain("raw payload");
    expect(html).not.toContain("<pre");
  });

  test("renders an unknown sensitive event with only its event id", () => {
    const html = renderPublicPage(
      <EventsIndex
        auth={{ user: { userId: adminId, role: "Admin" } }}
        errors={{}}
        flash={{}}
        events={[{
          actorUserId: adminId,
          aggregateId: "private-aggregate-id",
          aggregateName: "PrivateAggregate",
          eventId: EventId.schema.parse("78000000-0000-4000-8000-000000000099"),
          eventName: "future.private-event",
          occurredAt: Timestamp.schema.parse("2026-08-09T03:00:00.000Z"),
          payloadSensitivity: "Sensitive",
        }]}
      />,
    );

    expect(html).toContain("機微イベント");
    expect(html).toContain("78000000-0000-4000-8000-000000000099");
    expect(html).not.toContain("future.private-event");
    expect(html).not.toContain("private-aggregate-id");
    expect(html).not.toContain("PrivateAggregate");
    expect(html).not.toContain(String(adminId));
  });
});
