export default {
  subjects: { value: "exercises/guard/subjects/value.ts" },
  vitestBaseConfig: "vitest.base.config.mjs",
  cases: [
    { id: "B1-wrong", kind: "bad", subject: "value", title: "答えが違う", allow: ["tests"] },
    { id: "G1-right", kind: "good", subject: "value", title: "答えが正しい" },
  ],
};
