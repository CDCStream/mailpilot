import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/use-cases", label: "Use cases" },
      { href: "/compare", label: "Compare" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Features",
    links: [
      { href: "/features#triage", label: "Smart triage" },
      { href: "/features#drafts", label: "Voice-matched drafts" },
      { href: "/features#brief", label: "Daily brief" },
      { href: "/features#chat", label: "Ask your inbox" },
      { href: "/features#rules", label: "Rules & templates" },
      { href: "/features#multi", label: "Multi-inbox Gmail" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/security", label: "Security" },
      { href: "/#faq", label: "FAQ" },
      { href: "/contact", label: "Support" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/roadmap", label: "Roadmap" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/dpa", label: "DPA" },
      { href: "/subprocessors", label: "Sub-processors" },
      { href: "/data-request", label: "Data request" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-100 bg-zinc-50/80">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-xs">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <BrandLogo size={28} />
              <span className="font-semibold tracking-tight">Inbox Wingman</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              AI email for technical founders. Triage bots, draft humans, brief incidents —
              never send without you.
            </p>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {col.title}
                </p>
                <ul className="mt-3 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-zinc-600 hover:text-zinc-900"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-zinc-200 pt-6 text-xs text-zinc-400 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Inbox Wingman</p>
          <p>Works inside Gmail · Never sends without you</p>
        </div>
      </div>
    </footer>
  );
}
