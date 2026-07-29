import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export function SiteHeader({ ctaHref = "/login", ctaLabel = "Sign in" }: { ctaHref?: string; ctaLabel?: string }) {
  return (
    <header className="border-b border-zinc-100/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-3">
          <BrandLogo size={36} />
          <span className="text-lg font-semibold tracking-tight">Inbox Wingman</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/features" className="hidden text-zinc-600 hover:text-zinc-900 sm:inline">
            Features
          </Link>
          <Link href="/#pricing" className="text-zinc-600 hover:text-zinc-900">
            Pricing
          </Link>
          <Link href="/#faq" className="hidden text-zinc-600 hover:text-zinc-900 md:inline">
            FAQ
          </Link>
          <Link
            href={ctaHref}
            className="rounded-full bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800"
          >
            {ctaLabel}
          </Link>
        </nav>
      </div>
    </header>
  );
}
