import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { getAllArticles } from "@/lib/blog";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Inbox Wingman Blog — Gmail triage and inbox guides",
  description:
    "Practical guides on Gmail, email triage, and getting out of your inbox faster — from the team behind Inbox Wingman.",
  path: "/blog",
});

export default async function BlogIndexPage() {
  const articles = await getAllArticles();

  return (
    <MarketingShell wide>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Resources</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Blog</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-600">
        Practical guides on Gmail, email triage, and getting out of your inbox faster.
      </p>

      {articles.length === 0 ? (
        <p className="mt-12 text-zinc-500">First articles are on the way.</p>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {articles.map((a) => (
            <Link
              key={a.slug}
              href={`/blog/${a.slug}`}
              className="group rounded-2xl border border-zinc-200 p-6 transition hover:border-zinc-300 hover:shadow-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-teal-700">
                {a.category}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-900 group-hover:underline">
                {a.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{a.description}</p>
              <p className="mt-4 text-xs text-zinc-400">
                {new Date(a.date + "T00:00:00Z").toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {a.readingMinutes} min read
              </p>
            </Link>
          ))}
        </div>
      )}
    </MarketingShell>
  );
}
