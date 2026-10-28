import type { RecordUsageRequest } from "@app/shared";

/** One thing a team member did, and when (ISO time). */
export type UsageRecord = RecordUsageRequest & { username: string; at: string };

/** Where usage is kept (ADR 0023): apart from casting data, and never copied with it. */
export interface UsageStore {
  record(entry: UsageRecord): Promise<void>;
  /** Everything recorded at or after `from` (ISO time), oldest first. */
  since(from: string): Promise<UsageRecord[]>;
  /** When the first usage was recorded; undefined while none has been. */
  recordedSince(): Promise<string | undefined>;
}

/** For tests and local runs: kept only for as long as the process runs (usage-tracking AC14). */
export function inMemoryUsageStore(): UsageStore {
  const records: UsageRecord[] = [];
  let first: string | undefined;
  return {
    async record(entry) {
      first ??= entry.at;
      records.push(entry);
    },
    since: async (from) =>
      records.filter((entry) => entry.at >= from).sort((a, b) => a.at.localeCompare(b.at)),
    recordedSince: async () => first,
  };
}
