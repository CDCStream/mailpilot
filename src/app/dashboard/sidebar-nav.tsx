"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: "Mail",
    items: [
      { href: "/dashboard", label: "Overview" },
      { href: "/dashboard/inbox", label: "Inbox" },
      { href: "/dashboard/drafts", label: "Drafts" },
      { href: "/dashboard/briefs", label: "Daily Briefs" },
    ],
  },
  {
    title: "AI",
    items: [
      { href: "/dashboard/chat", label: "AI Chat" },
      { href: "/dashboard/rules", label: "Rules" },
      { href: "/dashboard/training", label: "AI Training" },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/dashboard/settings", label: "Settings" },
      { href: "/dashboard/billing", label: "Billing" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

/** Sidebar links on desktop; the same list renders as a horizontal scroller on mobile. */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-8 min-h-0 flex-1 space-y-7 overflow-y-auto">
      {GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {group.title}
          </p>
          <ul className="mt-2 space-y-1">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-xl px-3.5 py-2.5 text-[15px] transition ${
                      active
                        ? "bg-gradient-to-r from-teal-600 to-emerald-500 font-medium text-white shadow-sm"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const items = GROUPS.flatMap((g) => g.items);
  return (
    <nav className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${
              active ? "bg-gradient-to-r from-teal-600 to-emerald-500 font-medium text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
