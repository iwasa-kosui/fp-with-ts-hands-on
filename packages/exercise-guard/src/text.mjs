/**
 * @param {number} codePoint
 * @returns {number}
 */
const charWidth = (codePoint) =>
  (codePoint >= 0x1100 && codePoint <= 0x115f) ||
  (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
  (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
  (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
  (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
  (codePoint >= 0xff00 && codePoint <= 0xff60) ||
  (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
  (codePoint >= 0x20000 && codePoint <= 0x3fffd)
    ? 2
    : 1;

/**
 * @param {string} value
 * @returns {number}
 */
export const stringWidth = (value) =>
  [...value].reduce((sum, char) => sum + charWidth(char.codePointAt(0) ?? 0), 0);

/**
 * @param {string} value
 * @param {number} width
 * @returns {string}
 */
export const padEndWidth = (value, width) =>
  value + " ".repeat(Math.max(0, width - stringWidth(value)));

const noLineStart = "。、，．）」』】〕〉》］｝！？";

/**
 * @param {string} value
 * @param {number} maxWidth
 * @returns {readonly string[]}
 */
export const wrapByWidth = (value, maxWidth) => {
  const tokens = (value.match(/[\x21-\x7e]+|[\s\S]/gu) ?? []).flatMap((token) =>
    stringWidth(token) > maxWidth ? [...token] : [token],
  );
  const lines = tokens.reduce(
    (acc, token) => {
      const current = acc[acc.length - 1] ?? [];
      const last = current[current.length - 1];
      if (stringWidth(current.join("") + token) <= maxWidth) {
        return [...acc.slice(0, -1), [...current, token]];
      }
      return noLineStart.includes(token.charAt(0)) && last !== undefined && current.length > 1
        ? [...acc.slice(0, -1), current.slice(0, -1), [last, token]]
        : [...acc.slice(0, -1), current, [token]];
    },
    /** @type {readonly (readonly string[])[]} */ ([[]]),
  );
  return lines.map((line, index) => {
    const text = line.join("");
    return index === 0 ? text.trimEnd() : text.trimStart().trimEnd();
  });
};
