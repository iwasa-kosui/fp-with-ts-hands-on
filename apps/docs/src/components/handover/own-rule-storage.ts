import { noticeMoments, type NoticeMomentId } from "./notice-moments";

export const STORAGE_KEY = "fp-with-ts:own-rule:session-00";

export const momentFields = ["now", "goal"] as const;

export type MomentField = (typeof momentFields)[number];
export type Saved = { version: 1; rule: string; now?: NoticeMomentId; goal?: NoticeMomentId };

export const momentLabel = (id: NoticeMomentId): string =>
  noticeMoments.find((moment) => moment.id === id)?.label ?? id;

export const isMomentId = (value: unknown): value is NoticeMomentId =>
  typeof value === "string" && noticeMoments.some((moment) => moment.id === value);

export const load = (): Saved => {
  const empty: Saved = { version: 1, rule: "" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return empty;
    const record = parsed as Record<string, unknown>;
    const result: Saved = { version: 1, rule: typeof record.rule === "string" ? record.rule : "" };
    for (const field of momentFields) {
      const value = record[field];
      if (isMomentId(value)) result[field] = value;
    }
    return result;
  } catch {
    return empty;
  }
};

export const save = (saved: Saved): boolean => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
};
