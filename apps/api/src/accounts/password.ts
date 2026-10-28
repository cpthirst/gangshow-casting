import { randomInt } from "node:crypto";

// No 0/O or 1/l/I, so a password read off a screen is typed in right first time.
const KINDS = ["abcdefghijkmnopqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!#%*+=?@"];
const ALL = KINDS.join("");
const LENGTH = 16;

const pick = (characters: string) => characters.charAt(randomInt(characters.length));

/**
 * A password from a cryptographically secure generator, meeting the user pool's policy
 * (ADR 0018): Cognito returns none when it doesn't send an invitation.
 */
export function generatePassword(): string {
  const characters = KINDS.map(pick);
  while (characters.length < LENGTH) characters.push(pick(ALL));
  // Shuffled, so the guaranteed kinds aren't always at the start.
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [characters[i], characters[j]] = [characters[j] ?? "", characters[i] ?? ""];
  }
  return characters.join("");
}
