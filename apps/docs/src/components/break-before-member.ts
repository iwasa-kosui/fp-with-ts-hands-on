import type { Code } from "astro:components";
import type { ComponentProps } from "astro/types";
import { keyedTransformer } from "./code-cache-key";

type Transformer = NonNullable<ComponentProps<typeof Code>["transformers"]>[number];
type LineNode = Parameters<NonNullable<Transformer["line"]>>[0];
type Child = LineNode["children"][number];
type Element = Extract<Child, { type: "element" }>;
type Content = Element["children"][number];

const AFTER_NAME = /[\w)\]]$/;
const BEFORE_MEMBER = /(?<=[\w)\]])(?=\.)/;
const wbr = (): Element => ({ type: "element", tagName: "wbr", properties: {}, children: [] });
const text = (value: string): Content => ({ type: "text", value });

const withBreaks = (children: readonly Child[]): Child[] => {
  let previous = "";
  return children.flatMap((child): Child[] => {
    if (child.type !== "element") return [child];
    const spanText = child.children.flatMap((grandchild) => (grandchild.type === "text" ? [grandchild.value] : [])).join("");
    const lead = spanText.startsWith(".") && AFTER_NAME.test(previous) ? [wbr()] : [];
    const inner = child.children.flatMap((grandchild): Content[] => {
      if (grandchild.type !== "text") return [grandchild];
      return grandchild.value.split(BEFORE_MEMBER).flatMap((part, index) => (index === 0 ? [text(part)] : [wbr(), text(part)]));
    });
    previous = spanText;
    return [...lead, { ...child, children: inner }];
  });
};

export const breakBeforeMember = keyedTransformer<Transformer>("break-before-member", {
  name: "break-before-member",
  line(node) {
    node.children = withBreaks(node.children);
  },
});
