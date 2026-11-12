import { MAX_NOTE_LENGTH } from "@app/shared";

/** Below this many left, a field says how many: volunteers rarely get close, so a field carries
 *  no permanent hint line. */
const COUNT_FROM_REMAINING = 50;

const characters = (n: number) => (n === 1 ? "1 character" : `${n} characters`);

/**
 * How many characters are left in a free-text field of up to 500, such as an item's notes or a
 * costume field, said only near the limit, and how many too many past it. Counted as the text
 * will be saved: trimmed.
 */
export function charactersLeft(text: string) {
  const left = MAX_NOTE_LENGTH - text.trim().length;
  if (left >= COUNT_FROM_REMAINING) return "";
  return left < 0 ? `${characters(-left)} too many` : `${characters(left)} left`;
}
