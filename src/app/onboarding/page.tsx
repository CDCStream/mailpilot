import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, users } from "@/lib/db";
import { OnboardingProgress } from "./progress";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (user?.onboardedAt) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold">Setting up your inbox</h1>
        <p className="mt-3 text-sm text-zinc-600">
          MailPilot is creating your Gmail labels, learning your writing style from your
          sent mail, and triaging your most recent emails. This takes a minute or two.
        </p>
        <OnboardingProgress />
      </div>
    </main>
  );
}
