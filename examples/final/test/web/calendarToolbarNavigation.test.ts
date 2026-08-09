import { describe, expect, test } from "vitest";

import {
  calendarQuery,
  normalizeCalendarView,
} from "../../src/adaptor/primary/web/components/calendarToolbarNavigation.js";

const veterinarianId = "89000000-0000-4000-8000-000000000001";

describe("calendar toolbar navigation", () => {
  test("retains the date, view, veterinarian filter, and canceled filter for every toolbar destination", () => {
    expect(calendarQuery({ date: "2026-08-09", view: "week", veterinarianId, includeCanceled: true })).toBe(
      `/appointments?date=2026-08-09&view=week&veterinarianId=${veterinarianId}&canceled=1`,
    );
    expect(calendarQuery({ date: "2026-08-02", view: "week", veterinarianId, includeCanceled: true })).toContain(`date=2026-08-02&view=week&veterinarianId=${veterinarianId}&canceled=1`);
    expect(calendarQuery({ date: "2026-08-16", view: "week", veterinarianId, includeCanceled: true })).toContain(`date=2026-08-16&view=week&veterinarianId=${veterinarianId}&canceled=1`);
    expect(calendarQuery({ date: "2026-08-09", view: "day", veterinarianId, includeCanceled: true })).toContain(`date=2026-08-09&view=day&veterinarianId=${veterinarianId}&canceled=1`);
    expect(calendarQuery({ date: "2026-08-09", view: "week", veterinarianId: null, includeCanceled: true })).toBe("/appointments?date=2026-08-09&view=week&canceled=1");
    expect(calendarQuery({ date: "2026-08-09", view: "week", veterinarianId, includeCanceled: false })).toBe(`/appointments?date=2026-08-09&view=week&veterinarianId=${veterinarianId}`);
  });

  test("normalizes an unspecified view with the injected compact viewport and replace navigation", () => {
    let received: Readonly<{ href: string; replace: boolean }> | undefined;

    normalizeCalendarView({
      requestedView: null,
      date: "2026-08-09",
      veterinarianId,
      includeCanceled: true,
      isCompactViewport: () => true,
      navigate: (href, options) => { received = { href, replace: options.replace }; },
    });

    expect(received).toEqual({
      href: `/appointments?date=2026-08-09&view=day&veterinarianId=${veterinarianId}&canceled=1`,
      replace: true,
    });
  });

  test("does not navigate when the route already selected a view", () => {
    let calls = 0;

    normalizeCalendarView({
      requestedView: "week",
      date: "2026-08-09",
      veterinarianId: null,
      includeCanceled: false,
      isCompactViewport: () => false,
      navigate: () => { calls += 1; },
    });

    expect(calls).toBe(0);
  });
});
