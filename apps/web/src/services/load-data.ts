import { apiFetch } from "./sign-in.ts";

/** What reads the API's answer: one of the shared zod schemas. */
interface Schema<T> {
  parse(data: unknown): T;
}

/**
 * The data at one of the API's paths, read by its schema: the one way every page loads.
 * Not found is nothing there yet, so undefined. Any other answer that isn't OK, an answer
 * the schema can't read, or no answer at all, is a failure, so it throws: a page must never
 * show a failure as empty. A refused sign-in throws too, but apiFetch has already asked the
 * person to sign in, which the app shows in place of the page.
 */
export async function loadData<T>(path: string, schema: Schema<T>): Promise<T | undefined> {
  const res = await apiFetch(path);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return schema.parse(await res.json());
}
