import Link from "next/link";
import { redirect } from "next/navigation";
import NextTopLoader from "nextjs-toploader";
import { eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db, emailAccounts, users } from "@/lib/db";
import { maxAccountsFor } from "@/lib/plans";
import { resolveCreditLimit } from "@/lib/usage";
import { BrandLogo } from "@/components/brand-logo";
import { AccountSwitcher } from "./account-switcher";
import { getActiveAccountId } from "./active-account";
import { CreditsBanner } from "./credits-banner";
import { MobileNav, SidebarNav } from "./sidebar-nav";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Stale JWT (user deleted from the DB) — clear the cookie and start over.
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true },
  });
  if (!dbUser) redirect("/api/session/clear");

  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, session.user.id),
    columns: { id: true, email: true, status: true },
  });
  const cookieId = await getActiveAccountId();
  const activeId = accounts.some((a) => a.id === cookieId) ? cookieId : null;
  const { plan } = await resolveCreditLimit(session.user.id);
  const canAdd = accounts.length < maxAccountsFor(plan);
  const switcher = (
    <AccountSwitcher accounts={accounts} activeId={activeId} canAdd={canAdd} />
  );

  const signOutForm = (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button type="submit" className="text-sm text-zinc-500 hover:text-zinc-900">
        Sign out
      </button>
    </form>
  );

  return (
    <div className="flex min-h-screen">
      {/* Subtle page-transition indicator along the very top */}
      <NextTopLoader color="#0d9488" height={3} showSpinner={false} shadow={false} />

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-zinc-100 bg-zinc-50/60 px-4 py-7 md:flex">
        <Link
          href="/"
          className="inline-flex items-center gap-3 px-3 text-lg font-semibold tracking-tight"
        >
          <BrandLogo size={32} />
          Inbox Wingman
        </Link>
        <div className="mt-6">{switcher}</div>
        <SidebarNav />
        <div className="border-t border-zinc-200 px-3 pt-5">
          <p className="truncate text-sm text-zinc-400">{session.user.email}</p>
          <div className="mt-2">{signOutForm}</div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-zinc-100 md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/" className="inline-flex items-center gap-2 text-base font-semibold">
              <BrandLogo size={26} />
              Inbox Wingman
            </Link>
            {signOutForm}
          </div>
          <div className="px-4 pb-3">{switcher}</div>
          <MobileNav />
        </header>
        <CreditsBanner userId={session.user.id} />
        {/* Pages size themselves; the inbox goes full-bleed for an email-client feel. */}
        <main className="w-full min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
