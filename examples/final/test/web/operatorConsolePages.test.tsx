import { Link } from "@inertiajs/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";

import Layout from "../../src/adaptor/primary/web/pages/Layout.js";
import AppointmentNew, {
  toAppointmentTimestamp,
} from "../../src/adaptor/primary/web/pages/Appointments/New.js";
import AppointmentShow from "../../src/adaptor/primary/web/pages/Appointments/Show.js";
import AppointmentEdit from "../../src/adaptor/primary/web/pages/Appointments/Edit.js";
import WalkInNew from "../../src/adaptor/primary/web/pages/Reception/WalkIn.js";
import AppointmentCalendar from "../../src/adaptor/primary/web/components/AppointmentCalendar.js";
import { ReceptionRow } from "../../src/adaptor/primary/web/components/ReceptionRow.js";
import { suggestedDurationAfterServiceChange } from "../../src/adaptor/primary/web/components/AppointmentForm.js";
import Dashboard from "../../src/adaptor/primary/web/pages/Dashboard.js";
import EventsIndex, {
  SensitiveAuditPayloadDetail,
} from "../../src/adaptor/primary/web/pages/Events/Index.js";
import UserForm from "../../src/adaptor/primary/web/pages/Users/Form.js";
import UsersIndex from "../../src/adaptor/primary/web/pages/Users/Index.js";
import FollowUpsIndex from "../../src/adaptor/primary/web/pages/FollowUps/Index.js";
import Login from "../../src/adaptor/primary/web/pages/Login.js";
import Setup from "../../src/adaptor/primary/web/pages/Setup.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { AppointmentVersion } from "../../src/domain/appointment/appointmentVersion.js";
import { CancellationReason } from "../../src/domain/appointment/cancellationReason.js";
import { PaymentAmount } from "../../src/domain/appointment/paymentAmount.js";
import { SettlementAdjustmentAmount } from "../../src/domain/appointment/settlementAdjustmentAmount.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { PetId } from "../../src/domain/pet/petId.js";
import { UserId } from "../../src/domain/user/userId.js";
import type { AppointmentCalendarItem } from "../../src/useCase/query/appointmentCalendarReader.js";
import type { ReceptionBoardRow } from "../../src/useCase/query/receptionBoardReader.js";

const adminId = UserId.schema.parse(
  "76000000-0000-4000-8000-000000000001",
);

const renderPublicPage = (page: ReactElement): string =>
  renderToString(page);

const visibleText = (html: string): string =>
  html.replaceAll("<!-- -->", "").replaceAll(/<[^>]*>/g, "");

const ownerId = OwnerId.schema.parse("73000000-0000-4000-8000-000000000001");
const petId = PetId.schema.parse("74000000-0000-4000-8000-000000000001");
const appointmentId = AppointmentId.schema.parse("75000000-0000-4000-8000-000000000001");
const scheduledAt = Timestamp.schema.parse("2026-08-10T03:00:00.000Z");
const appointmentBase = {
  appointmentId,
  ownerId,
  ownerName: "Hanako Owner",
  petId,
  petName: "Mugi",
  scheduledAt,
  scheduledEndsAt: Timestamp.schema.parse("2026-08-10T03:30:00.000Z"),
  durationMinutes: 30 as const,
  serviceCode: "GeneralConsultation" as const,
  bookingKind: "Reserved" as const,
  assignedVeterinarianId: null,
  assignedVeterinarianName: "未定",
  visitReason: "定期健診",
  receptionNote: null,
  settlement: { kind: "NoPayment" as const },
  version: AppointmentVersion.schema.parse(1),
};
const noAppointmentActions = {
  edit: false,
  checkIn: false,
  reassignVeterinarian: false,
  updateReceptionNote: false,
  receiveDeposit: false,
  startExamination: false,
  recordExamResult: false,
  settle: false,
  cancel: false,
} as const;

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
    expect(html).toContain('href="/reception"');
    expect(html.indexOf('href="/appointments"')).toBeLessThan(html.indexOf('href="/reception"'));
    expect(html.indexOf('href="/reception"')).toBeLessThan(html.indexOf('href="/owners"'));
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
    expect(html).toContain('aria-label="予約カレンダー"');
    expect(html).toContain('aria-label="受付ボード"');
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
    expect(html).toContain('href="/reception"');
    expect(html).toContain('href="/owners"');
    expect(html).toContain('href="/pets"');
    expect(html).toContain('href="/follow-ups"');
    expect(html).toContain('aria-label="フォローアップ"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('href="/users"');
    expect(html).not.toContain('href="/events"');
  });

  test("keeps internal appointment and role codes out of visible Japanese operator text", () => {
    const roles = ["Admin", "Receptionist", "Veterinarian"] as const;
    const roleNames = ["管理者ユーザー", "受付ユーザー", "獣医師ユーザー"] as const;
    const users = roles.map((role, index) => ({
      userId: UserId.schema.parse(`76000000-0000-4000-8000-00000000000${index + 2}`),
      role,
      email: `${role.toLowerCase()}@example.test`,
      name: roleNames[index],
    }));
    const calendarAppointments: readonly AppointmentCalendarItem[] = [
      {
        appointmentId: AppointmentId.schema.parse("75000000-0000-4000-8000-000000000011"),
        startsAt: Timestamp.schema.parse("2026-08-10T00:00:00.000Z"),
        endsAt: Timestamp.schema.parse("2026-08-10T00:15:00.000Z"),
        durationMinutes: 15,
        petName: "むぎ1",
        serviceCode: "GeneralConsultation",
        bookingKind: "Reserved",
        assignedVeterinarianId: null,
        assignedVeterinarianName: null,
        appointmentStatus: "Scheduled",
        settlementStatus: "NoPayment",
      },
      {
        appointmentId: AppointmentId.schema.parse("75000000-0000-4000-8000-000000000012"),
        startsAt: Timestamp.schema.parse("2026-08-10T00:20:00.000Z"),
        endsAt: Timestamp.schema.parse("2026-08-10T00:35:00.000Z"),
        durationMinutes: 15,
        petName: "むぎ2",
        serviceCode: "Vaccination",
        bookingKind: "WalkIn",
        assignedVeterinarianId: null,
        assignedVeterinarianName: null,
        appointmentStatus: "CheckedIn",
        settlementStatus: "DepositReceived",
      },
      {
        appointmentId: AppointmentId.schema.parse("75000000-0000-4000-8000-000000000013"),
        startsAt: Timestamp.schema.parse("2026-08-10T00:40:00.000Z"),
        endsAt: Timestamp.schema.parse("2026-08-10T00:55:00.000Z"),
        durationMinutes: 15,
        petName: "むぎ3",
        serviceCode: "FollowUpVisit",
        bookingKind: "Reserved",
        assignedVeterinarianId: null,
        assignedVeterinarianName: null,
        appointmentStatus: "InExamination",
        settlementStatus: "NoPayment",
      },
      {
        appointmentId: AppointmentId.schema.parse("75000000-0000-4000-8000-000000000014"),
        startsAt: Timestamp.schema.parse("2026-08-10T01:00:00.000Z"),
        endsAt: Timestamp.schema.parse("2026-08-10T01:15:00.000Z"),
        durationMinutes: 15,
        petName: "むぎ4",
        serviceCode: "Vaccination",
        bookingKind: "Reserved",
        assignedVeterinarianId: null,
        assignedVeterinarianName: null,
        appointmentStatus: "AwaitingPayment",
        settlementStatus: "DepositReceived",
      },
      {
        appointmentId: AppointmentId.schema.parse("75000000-0000-4000-8000-000000000015"),
        startsAt: Timestamp.schema.parse("2026-08-10T01:20:00.000Z"),
        endsAt: Timestamp.schema.parse("2026-08-10T01:35:00.000Z"),
        durationMinutes: 15,
        petName: "むぎ5",
        serviceCode: "ExaminationOrProcedure",
        bookingKind: "Reserved",
        assignedVeterinarianId: null,
        assignedVeterinarianName: null,
        appointmentStatus: "Paid",
        settlementStatus: "Settled",
      },
      {
        appointmentId: AppointmentId.schema.parse("75000000-0000-4000-8000-000000000016"),
        startsAt: Timestamp.schema.parse("2026-08-10T01:40:00.000Z"),
        endsAt: Timestamp.schema.parse("2026-08-10T01:55:00.000Z"),
        durationMinutes: 15,
        petName: "むぎ6",
        serviceCode: "Vaccination",
        bookingKind: "WalkIn",
        assignedVeterinarianId: null,
        assignedVeterinarianName: null,
        appointmentStatus: "Canceled",
        settlementStatus: "DepositRefunded",
      },
    ];
    const receptionRows: readonly ReceptionBoardRow[] = calendarAppointments.map(
      (item, index) => ({
        appointmentId: item.appointmentId,
        version: AppointmentVersion.schema.parse(index + 1),
        bookingKind: item.bookingKind,
        scheduledAt: item.startsAt,
        checkedInAt: item.appointmentStatus === "Scheduled"
          ? null
          : Timestamp.schema.parse("2026-08-10T00:05:00.000Z"),
        waitingMinutes: item.appointmentStatus === "Scheduled" ? null : 5,
        ownerName: `飼い主${index + 1}`,
        petName: item.petName,
        receptionNote: null,
        serviceCode: item.serviceCode,
        assignedVeterinarianName: null,
        appointmentStatus: item.appointmentStatus,
        settlementStatus: item.settlementStatus,
        primaryAction: "OpenDetails",
      }),
    );
    const showHtml = [
      renderPublicPage(
        <AppointmentShow
          actions={noAppointmentActions}
          appointment={{ ...appointmentBase, kind: "Scheduled" }}
          auth={{ user: { userId: adminId, role: "Receptionist" } }}
          errors={{}}
          flash={{}}
          veterinarianId={null}
        />,
      ),
      renderPublicPage(
        <AppointmentShow
          actions={noAppointmentActions}
          appointment={{
            ...appointmentBase,
            kind: "Scheduled",
            serviceCode: "Vaccination",
            settlement: {
              kind: "DepositReceived",
              depositAmount: PaymentAmount.schema.parse(8000),
              receivedAt: Timestamp.schema.parse("2026-08-10T00:10:00.000Z"),
            },
          }}
          auth={{ user: { userId: adminId, role: "Receptionist" } }}
          errors={{}}
          flash={{}}
          veterinarianId={null}
        />,
      ),
      renderPublicPage(
        <AppointmentShow
          actions={noAppointmentActions}
          appointment={{
            ...appointmentBase,
            kind: "Paid",
            assignedVeterinarianId: "77000000-0000-4000-8000-000000000001",
            assignedVeterinarianName: "佐藤 獣医師",
            veterinarianName: "佐藤 獣医師",
            checkedInAt: Timestamp.schema.parse("2026-08-10T00:05:00.000Z"),
            examinationStartedAt: Timestamp.schema.parse("2026-08-10T00:10:00.000Z"),
            examId: "71000000-0000-4000-8000-000000000030",
            examinationCompletedAt: Timestamp.schema.parse("2026-08-10T00:20:00.000Z"),
            diagnosis: "接種可能",
            treatment: "ワクチン接種",
            settlement: {
              kind: "Settled",
              finalAmount: PaymentAmount.schema.parse(5000),
              depositAmount: SettlementAdjustmentAmount.schema.parse(8000),
              additionalPaymentAmount: SettlementAdjustmentAmount.schema.parse(0),
              refundAmount: SettlementAdjustmentAmount.schema.parse(3000),
              settledAt: Timestamp.schema.parse("2026-08-10T00:30:00.000Z"),
            },
          }}
          auth={{ user: { userId: adminId, role: "Receptionist" } }}
          errors={{}}
          flash={{}}
          veterinarianId={null}
        />,
      ),
      renderPublicPage(
        <AppointmentShow
          actions={noAppointmentActions}
          appointment={{
            ...appointmentBase,
            kind: "Canceled",
            serviceCode: "Vaccination",
            cancellationReason: CancellationReason.schema.parse("飼い主都合"),
            canceledAt: Timestamp.schema.parse("2026-08-10T00:15:00.000Z"),
            settlement: {
              kind: "DepositRefunded",
              depositAmount: PaymentAmount.schema.parse(6000),
              refundedAt: Timestamp.schema.parse("2026-08-10T00:15:00.000Z"),
            },
          }}
          auth={{ user: { userId: adminId, role: "Receptionist" } }}
          errors={{}}
          flash={{}}
          veterinarianId={null}
        />,
      ),
    ].join("\n");
    const calendarHtml = renderPublicPage(
      <AppointmentCalendar
        appointments={calendarAppointments}
        date="2026-08-10"
        selectedVeterinarianId={null}
        veterinarians={[]}
        view="day"
      />,
    );
    const receptionHtml = receptionRows
      .map((row) => renderPublicPage(<ReceptionRow row={row} />))
      .join("\n");
    const formHtml = renderPublicPage(
      <AppointmentNew
        auth={{ user: { userId: adminId, role: "Receptionist" } }}
        errors={{}}
        flash={{}}
        owners={[{ ownerId, name: "山田 花子" }]}
        pets={[{ ownerId, petId, name: "むぎ" }]}
        veterinarians={[]}
      />,
    );
    const html = [
      ...roles.map((role) => renderToString(
        <Layout title="予約詳細" user={{ userId: adminId, role }}>
          <p>業務画面</p>
        </Layout>,
      )),
      renderToString(
        <UsersIndex
          auth={{ user: { userId: adminId, role: "Admin" } }}
          errors={{}}
          flash={{}}
          users={users}
        />,
      ),
      renderToString(
        <UserForm
          auth={{ user: { userId: adminId, role: "Admin" } }}
          errors={{}}
          flash={{}}
          mode="create"
          user={null}
        />,
      ),
      showHtml,
      calendarHtml,
      receptionHtml,
      formHtml,
    ].join("\n");
    const operatorText = visibleText(html);
    const calendarText = visibleText(calendarHtml);
    const receptionText = visibleText(receptionHtml);
    const appointmentDetailText = visibleText(showHtml);

    expect(calendarAppointments.map(({ appointmentStatus }) => appointmentStatus)).toEqual([
      "Scheduled", "CheckedIn", "InExamination", "AwaitingPayment", "Paid", "Canceled",
    ]);
    expect(new Set(calendarAppointments.map(({ serviceCode }) => serviceCode))).toEqual(new Set([
      "GeneralConsultation", "FollowUpVisit", "Vaccination", "ExaminationOrProcedure",
    ]));
    expect(new Set(calendarAppointments.map(({ bookingKind }) => bookingKind))).toEqual(
      new Set(["Reserved", "WalkIn"]),
    );
    expect(new Set(calendarAppointments.map(({ settlementStatus }) => settlementStatus))).toEqual(
      new Set(["NoPayment", "DepositReceived", "Settled", "DepositRefunded"]),
    );
    expect(receptionRows.map(({ appointmentStatus }) => appointmentStatus)).toEqual([
      "Scheduled", "CheckedIn", "InExamination", "AwaitingPayment", "Paid", "Canceled",
    ]);

    for (const internalCode of [
      "Scheduled", "CheckedIn", "InExamination", "AwaitingPayment",
      "Paid", "Canceled", "Admin", "Receptionist", "Veterinarian",
      "GeneralConsultation", "FollowUpVisit", "Vaccination",
      "ExaminationOrProcedure", "Reserved", "WalkIn", "NoPayment",
      "DepositReceived", "Settled", "DepositRefunded",
    ]) {
      expect(operatorText).not.toContain(internalCode);
    }
    for (const label of ["管理者", "受付", "獣医師"]) {
      expect(operatorText).toContain(label);
    }
    for (const label of [
      "予約済み", "受付済み", "診察中", "会計待ち", "会計済み", "キャンセル",
      "一般診療", "再診", "予防接種", "検査・処置", "予約", "飛び込み",
      "未精算", "前受金受領済み", "精算済み", "前受金返金済み",
    ]) {
      expect(calendarText).toContain(label);
    }
    for (const label of ["未受付", "診察待ち", "診察中", "会計待ち", "会計済み", "キャンセル"]) {
      expect(receptionText).toContain(label);
    }
    for (const label of [
      "前受金 8000 円受領済み", "3000 円返金して精算済み", "前受金 6000 円返金済み",
    ]) {
      expect(appointmentDetailText).toContain(label);
    }
    expect(formHtml).toContain('value="GeneralConsultation"');
    expect(formHtml).toContain('value="Vaccination"');
    expect(html).toContain('value="Admin"');
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
        veterinarians={[]}
      />,
    );

    expect(html).toContain('aria-label="予約登録"');
    expect(html).toContain('href="/appointments"');
    expect(html).toContain('name="scheduledAt"');
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain('aria-describedby="reason-error"');
    expect(html).toContain("一般診療");
    expect(html).toContain("再診");
    expect(html).toContain("予防接種");
    expect(html).toContain("検査・処置");
    expect(html).toContain("担当医未定");
  });

  test("shares the Japanese appointment fields across edit and walk-in forms", () => {
    const options = {
      owners: [{ ownerId, name: "Hanako Owner" }],
      pets: [{ ownerId, petId, name: "Mugi" }],
      veterinarians: [{
        veterinarianId: "77000000-0000-4000-8000-000000000001",
        name: "Clinic Vet",
      }],
    } as const;
    const editHtml = renderPublicPage(
      <AppointmentEdit
        {...options}
        appointment={{
          appointmentId,
          ownerId,
          petId,
          scheduledAt,
          durationMinutes: 30,
          serviceCode: "GeneralConsultation",
          assignedVeterinarianId: null,
          visitReason: "定期健診",
          version: 1,
          immutablePetAndService: false,
        }}
        auth={{ user: { userId: adminId, role: "Receptionist" } }}
        errors={{}}
        flash={{}}
      />,
    );
    const walkInHtml = renderPublicPage(
      <WalkInNew
        {...options}
        auth={{ user: { userId: adminId, role: "Receptionist" } }}
        errors={{ receptionNote: "受付メモを確認してください。" }}
        flash={{}}
      />,
    );

    for (const label of ["飼い主", "ペット", "診療メニュー", "所要時間", "担当獣医師", "来院理由"]) {
      expect(editHtml).toContain(label);
      expect(walkInHtml).toContain(label);
    }
    expect(editHtml).toContain('name="expectedVersion"');
    expect(walkInHtml).toContain("受付メモ");
    expect(walkInHtml).not.toContain('name="scheduledAt"');
  });

  test("suggests a service duration only until the operator manually changes it", () => {
    expect(suggestedDurationAfterServiceChange("Vaccination", false, 30)).toBe(15);
    expect(suggestedDurationAfterServiceChange("ExaminationOrProcedure", true, 45)).toBe(45);
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
          ...noAppointmentActions,
          settle: true,
        }}
        appointment={{
          ...appointmentBase,
          appointmentId,
          checkedInAt: Timestamp.schema.parse("2026-08-10T03:10:00.000Z"),
          examId: "71000000-0000-4000-8000-000000000030",
          examinationCompletedAt: Timestamp.schema.parse("2026-08-10T03:30:00.000Z"),
          examinationStartedAt: Timestamp.schema.parse("2026-08-10T03:20:00.000Z"),
          kind: "AwaitingPayment",
          assignedVeterinarianId: "77000000-0000-4000-8000-000000000001",
          assignedVeterinarianName: "Clinic Vet",
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
          ...noAppointmentActions,
          edit: true,
          reassignVeterinarian: true,
          cancel: true,
          checkIn: true,
        }}
        appointment={{
          ...appointmentBase,
          kind: "Scheduled",
        }}
        auth={{ user: { userId: adminId, role: "Receptionist" } }}
        errors={{}}
        flash={{}}
        veterinarianId={null}
        veterinarians={[{
          veterinarianId: "77000000-0000-4000-8000-000000000001",
          name: "Clinic Vet",
        }]}
      />,
    );
    const checkedInHtml = renderPublicPage(
      <AppointmentShow
        actions={{
          ...noAppointmentActions,
          reassignVeterinarian: true,
        }}
        appointment={{
          ...appointmentBase,
          kind: "CheckedIn",
          checkedInAt: Timestamp.schema.parse("2026-08-10T03:10:00.000Z"),
          version: AppointmentVersion.schema.parse(2),
        }}
        auth={{ user: { userId: adminId, role: "Receptionist" } }}
        errors={{}}
        flash={{}}
        veterinarianId={null}
        veterinarians={[{
          veterinarianId: "77000000-0000-4000-8000-000000000001",
          name: "Clinic Vet",
        }]}
      />,
    );

    expect(awaitingPaymentHtml).toContain('aria-label="予約情報"');
    expect(awaitingPaymentHtml).toContain('aria-label="現在の操作"');
    expect(awaitingPaymentHtml).toContain("会計待ち");
    expect(awaitingPaymentHtml).toContain("会計を記録");
    expect(awaitingPaymentHtml).not.toContain("診察結果を記録");
    expect(scheduledHtml).toContain("受付する");
    expect(scheduledHtml).toContain(`href="/appointments/${appointmentId}/edit"`);
    expect(scheduledHtml).toContain("予約内容を変更");
    expect(scheduledHtml).toContain('name="assignedVeterinarianId"');
    expect(scheduledHtml).toContain('name="expectedVersion"');
    expect(scheduledHtml).toContain("Clinic Vet");
    expect(scheduledHtml).toContain("担当獣医師を変更");
    expect(scheduledHtml).toContain("予約をキャンセル");
    expect(scheduledHtml).not.toContain("会計を記録");
    expect(checkedInHtml).not.toContain("予約内容を変更");
    expect(checkedInHtml).toContain('name="assignedVeterinarianId"');
    expect(checkedInHtml).toContain("担当獣医師を変更");
  });

  test("renders an action that the server authorizes even when the state does not imply it", () => {
    const html = renderPublicPage(
      <AppointmentShow
        actions={{
          ...noAppointmentActions,
          settle: true,
        }}
        appointment={{
          ...appointmentBase,
          kind: "Scheduled",
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
          ...noAppointmentActions,
        }}
        appointment={{
          ...appointmentBase,
          kind: "Scheduled",
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
          eventName: "appointment.final-settlement-recorded",
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
    expect(html).toContain("機微情報を開示");
    expect(html).toContain("76000000-0000-4000-8000-000000000001");
    expect(html).toContain("Appointment");
    expect(html).toContain("75000000-0000-4000-8000-000000000001");
    expect(html).not.toContain("<dl");
    expect(html).not.toContain("raw payload");
    expect(html).not.toContain("<pre");
  });

  test("明示開示した全JSONをPII警告・閉じる導線とともに安全なtext nodeで表示する", () => {
    const html = renderPublicPage(
      <SensitiveAuditPayloadDetail
        payload={{
          aggregateState: {
            kind: "Paid",
            internalCode: "EXAM-PRIVATE",
            nested: { attack: "</pre><script>alert('xss')</script>" },
          },
          eventPayload: {
            diagnosis: "機微な診断",
            array: ["one", { treatment: "機微な処置" }],
          },
        }}
        onClose={() => undefined}
      />,
    );

    expect(html).toContain("個人情報・診療情報を含みます");
    expect(html).toContain("集約状態（JSON）");
    expect(html).toContain("イベントペイロード（JSON）");
    expect(html).toContain("EXAM-PRIVATE");
    expect(html).toContain("機微な診断");
    expect(html).toContain("機微な処置");
    expect(html).toContain("閉じる");
    expect(html).toContain("&lt;/pre&gt;&lt;script&gt;");
    expect(html).not.toContain("</pre><script>");
  });

  test("機微payload閲覧イベントを通常の監査technical dataとして日本語表示する", () => {
    const targetEventId = EventId.schema.parse(
      "78000000-0000-4000-8000-000000000010",
    );
    const viewedAt = Timestamp.schema.parse("2026-08-09T03:01:00.000Z");
    const html = renderPublicPage(
      <EventsIndex
        auth={{ user: { userId: adminId, role: "Admin" } }}
        errors={{}}
        flash={{}}
        events={[{
          actorUserId: adminId,
          aggregateId: targetEventId,
          aggregateName: "Audit",
          eventId: EventId.schema.parse("78000000-0000-4000-8000-000000000011"),
          eventName: "audit.sensitive-payload-viewed",
          occurredAt: viewedAt,
          payloadSensitivity: "Regular",
          regularPayload: {
            aggregateState: null,
            eventPayload: {
              targetEventId,
              viewerUserId: adminId,
              viewedAt,
            },
          },
        }]}
      />,
    );

    expect(html).toContain("機微監査情報を開示");
    expect(html).toContain("targetEventId");
    expect(html).toContain(targetEventId);
    expect(html).not.toContain("機微情報を含みます");
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
