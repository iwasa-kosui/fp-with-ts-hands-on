import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { onboardingGuides } from "./onboarding-guides";

const sources = {
  "src/legacy/appointment.ts": readFileSync(
    resolve(
      process.cwd(),
      "../../examples/session-00/src/legacy/appointment.ts",
    ),
    "utf8",
  ),
  "src/legacy/logger.ts": readFileSync(
    resolve(process.cwd(), "../../examples/session-00/src/legacy/logger.ts"),
    "utf8",
  ),
} as const;

const expectedEvidence = {
  "string-status": ["status: string", "newStatus: string"],
  "optional-state-data": ["veterinarianId?: string", "cancelReason?: string"],
  "plain-string-ids": [
    "id: string",
    "petId: string",
    "ownerId: string",
    "veterinarianId?: string",
  ],
  "throw-not-found": ["throw new Error"],
  "raw-pii-log": [
    "ownerEmail: string",
    'logger.info("appointment booked", appointment)',
  ],
} as const;

describe("onboardingGuides", () => {
  it("points every unique guide at real source and evidence", () => {
    expect(onboardingGuides).toHaveLength(5);
    expect(new Set(onboardingGuides.map(({ id }) => id)).size).toBe(5);

    for (const guide of onboardingGuides) {
      const source = sources[guide.path as keyof typeof sources];
      expect(source, guide.path).toEqual(expect.any(String));
      const lines = source.split("\n");
      const highlighted = guide.highlights
        .flatMap(({ startLineNumber, endLineNumber }) =>
          lines.slice(startLineNumber - 1, endLineNumber),
        )
        .join("\n");
      for (const evidence of expectedEvidence[guide.id]) {
        expect(highlighted).toContain(evidence);
      }
    }
  });
});
