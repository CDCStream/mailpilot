import { cookies } from "next/headers";

export const ACTIVE_ACCOUNT_COOKIE = "wingman_active_account";

/**
 * The Gmail account the dashboard is currently scoped to, or null for
 * "All inboxes". Callers must still check the id belongs to the user's
 * accounts (a stale cookie can outlive a disconnected account).
 */
export async function getActiveAccountId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_ACCOUNT_COOKIE)?.value ?? null;
}
