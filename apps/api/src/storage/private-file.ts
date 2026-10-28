import { randomUUID } from "node:crypto";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

/**
 * Saves a file that holds children's names (ADR 0010): owner-only, and written to a temp
 * file then renamed into place, so a crash never leaves it half-written.
 */
export async function writePrivateFile(path: string, contents: string) {
  const folder = dirname(path);
  const prefix = `.${basename(path, ".json")}-`;
  const temp = join(folder, `${prefix}${randomUUID()}.tmp`);
  await mkdir(folder, { recursive: true });
  await sweepTempFiles(folder, prefix);
  try {
    await writeFile(temp, contents, { mode: 0o600 });
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true });
  }
}

// A crash between writing and renaming can leave a temp copy, which may hold someone later
// deleted. Clear any such leftovers before each save (ADR 0010: no copies).
async function sweepTempFiles(folder: string, prefix: string) {
  const leftovers = (await readdir(folder)).filter(
    (name) => name.startsWith(prefix) && name.endsWith(".tmp"),
  );
  await Promise.all(leftovers.map((name) => rm(join(folder, name), { force: true })));
}

/**
 * Runs changes one at a time, so two simultaneous saves can't overwrite each other. This
 * only holds within one process (the dev server); a hosted store needs its own guarantee.
 */
export function oneAtATime() {
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(change: () => Promise<T>): Promise<T> => {
    const result = queue.then(change);
    queue = result.catch(() => undefined);
    return result;
  };
}
