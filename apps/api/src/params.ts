/** A positive whole number from a path or query parameter (up to 9 digits, safely within a
 *  JS number), or undefined for anything else. */
export const wholeNumber = (text: string | undefined) =>
  text !== undefined && /^[1-9]\d{0,8}$/.test(text) ? Number(text) : undefined;
