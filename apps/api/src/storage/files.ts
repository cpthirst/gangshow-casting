/** Runs a read, returning undefined when the file or folder doesn't exist. */
export async function ifExists<T>(read: () => Promise<T>) {
  try {
    return await read();
  } catch (error) {
    if (hasCode(error, "ENOENT")) return undefined;
    throw error;
  }
}

export const hasCode = (error: unknown, code: string) =>
  error instanceof Error && "code" in error && error.code === code;
