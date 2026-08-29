import { describe, expect, it } from "vitest";

import { clinicFixture } from "../../../fixtures/clinic.js";
import type { AuditLog } from "../../src/adaptor/secondary/sqlite/appointmentRepository.js";
import type { Appointment } from "../../src/domain/appointment/appointment.js";
import { toPageProps } from "../../src/web/appointmentView.js";

const knownStatuses = [
  "scheduled",
  "checked-in",
  "in-examination",
  "awaiting-payment",
  "paid",
  "canceled",
] as const;

const appointment: Appointment = {
  appointmentId: clinicFixture.appointmentId,
  petId: clinicFixture.petId,
  petName: "Mugi",
  ownerId: clinicFixture.ownerId,
  ...clinicFixture.ownerContact,
  scheduledAt: clinicFixture.scheduledAt,
  reason: "skin check",
  status: "scheduled",
};

const auditLogFor = (current: Appointment): AuditLog => ({
  eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  appointmentId: current.appointmentId,
  eventName: "appointment.updated",
  payload: current,
  occurredAt: current.scheduledAt,
});

describe("Session 00 appointment view", () => {
  it.each(knownStatuses)(
    "既知status %sでも全主要操作をAvailableのまま表示する",
    (status) => {
      const current = { ...appointment, status };
      const props = toPageProps(current, [auditLogFor(current)], undefined);

      expect([
        props.actions.checkIn.kind,
        props.actions.startExamination.kind,
        props.actions.recordExamResult.kind,
        props.actions.recordPayment.kind,
        props.actions.cancel.kind,
      ]).toEqual([
        "Available",
        "Available",
        "Available",
        "Available",
        "Available",
      ]);
      expect(props.actions.requestFollowUp.kind).toBe("NotImplemented");
    },
  );

  it.each(["toString", "__proto__"] as const)(
    "Object prototype由来の名前 %s も文字列のまま未知statusとして表示する",
    (status) => {
      const current = { ...appointment, status };

      const props = toPageProps(current, [auditLogFor(current)], undefined);

      expect(props.appointment.kind).toBe(status);
      expect(props.appointment.statusLabel).toBe(status);
      expect(props.incidentLab?.inspection.warnings).toContain(
        "想定外の予約状態が保存されています",
      );
    },
  );

  it("監査が1件もない予約を監査欠落として警告する", () => {
    const props = toPageProps(appointment, [], undefined);

    expect(props.incidentLab?.inspection.warnings).toContain(
      "現在の予約内容に対応する変更履歴がありません",
    );
  });
});
