import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, users } from "@/lib/db";
import { OnboardingProgress } from "./progress";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  // Stale JWT (user deleted from the DB) — clear the cookie and start over.
  if (!user) redirect("/api/session/clear");
  if (user.onboardedAt) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-10 lg:px-12">
      <div className="w-full max-w-6xl">
        <h1 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
          Set up your inbox
        </h1>
        <OnboardingProgress />
      </div>
    </main>
  );
}
