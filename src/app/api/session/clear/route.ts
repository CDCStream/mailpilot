import { signOut } from "@/auth";

/**
 * Clears a stale session cookie — hit when a signed-in JWT references a user
 * that no longer exists in the database (deleted account, wiped test data).
 */
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
