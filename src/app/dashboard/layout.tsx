import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/rules", label: "Rules" },
  { href: "/dashboard/followups", label: "Follow-ups" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/billing", label: "Billing" },
];

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
              <Image src="/logo-64.png" alt="" width={24} height={24} className="rounded-md" />
              Inbox Wingman
            </Link>
            <nav className="flex gap-5 text-sm">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="text-zinc-600 hover:text-zinc-900">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
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
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
