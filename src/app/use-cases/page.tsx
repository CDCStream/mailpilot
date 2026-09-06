import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { marketingMetadata } from "@/lib/seo";
import { USE_CASE_HUB } from "@/lib/use-cases";

export const metadata = marketingMetadata({
  title: "Inbox Wingman Use Cases — Gmail AI for freelance developers",
  description:
    "How freelance developers and small studios use Inbox Wingman to triage Gmail, draft replies, and catch what matters.",
  path: "/use-cases",
});

export default function UseCasesPage() {
  return (
    <MarketingShell wide>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Product</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Use cases</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-600">
        Built for people who get 50+ emails a day and still need to sound human.
      </p>
      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {USE_CASE_HUB.map((c) => {
          const inner = (
            <>
              <h2 className="text-lg font-semibold">{c.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{c.body}</p>
              {c.href ? (
                <p className="mt-4 text-sm font-medium text-teal-800">Read the page →</p>
              ) : null}
            </>
          );
          return c.href ? (
            <Link
              key={c.title}
              href={c.href}
              className="rounded-2xl border border-zinc-200 p-6 hover:border-zinc-300"
            >
              {inner}
            </Link>
          ) : (
            <div key={c.title} className="rounded-2xl border border-zinc-200 p-6">
              {inner}
            </div>
          );
        })}
      </div>
      <p className="mt-10 text-center text-sm text-zinc-500">
        See{" "}
        <Link href="/features" className="font-medium text-zinc-800 underline">
          all features
        </Link>{" "}
        or{" "}
        <Link href="/#pricing" className="font-medium text-zinc-800 underline">
          pricing
        </Link>
        .
      </p>
    </MarketingShell>
  );
}
