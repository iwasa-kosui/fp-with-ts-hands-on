/**
 * @param {number} pgid
 * @returns {Promise<boolean>}
 */
export const groupGone = async (pgid) => {
  for (let remaining = 25; remaining > 0; remaining -= 1) {
    try {
      process.kill(-pgid, 0);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
};
