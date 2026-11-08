import path from "node:path";

/**
 * @param {string} value
 * @returns {string}
 */
export const toPosix = (value) => value.split(path.sep).join("/");

/**
 * @param {string} fromDir
 * @param {string} target
 * @returns {string}
 */
export const relativeSpecifier = (fromDir, target) => {
  const relative = toPosix(path.relative(fromDir, target));
  return relative.startsWith(".") ? relative : `./${relative}`;
};

/**
 * @param {string} parent
 * @param {string} child
 * @returns {boolean}
 */
export const isInside = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
};

/**
 * @param {string} root
 * @param {string} absolute
 * @returns {string}
 */
export const displayPath = (root, absolute) =>
  isInside(root, absolute) ? toPosix(path.relative(root, absolute)) : toPosix(absolute);
