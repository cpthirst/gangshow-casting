/** JSON.parse that returns undefined instead of throwing (whose message can quote the input). */
export function parseJson(text: string | undefined): unknown {
  try {
    return JSON.parse(text ?? "");
  } catch {
    return undefined;
  }
}
