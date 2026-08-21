export function pickLatestPerThread<T extends { threadId: string; receivedAt?: Date | null; createdAt?: Date }>(
  rows: T[],
): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const prev = best.get(row.threadId);
    const rowAt = row.receivedAt?.getTime() ?? row.createdAt?.getTime() ?? 0;
    const prevAt = prev ? (prev.receivedAt?.getTime() ?? prev.createdAt?.getTime() ?? 0) : -1;
    if (!prev || rowAt >= prevAt) best.set(row.threadId, row);
  }
  return [...best.values()];
}

export function draftedThreadIds<T extends { threadId: string; draftId?: string | null }>(rows: T[]): Set<string> {
  return new Set(rows.filter((r) => r.draftId).map((r) => r.threadId));
}

/** Keep the newest drafted row per thread for the "Drafts written for you" list. */
export function uniqueDraftsByThread<T extends { threadId: string; receivedAt?: Date | null; createdAt?: Date }>(
  rows: T[],
): T[] {
  return pickLatestPerThread(rows);
}
