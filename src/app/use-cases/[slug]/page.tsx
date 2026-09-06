import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentCta } from "@/components/content-cta";
import { JsonLd } from "@/components/json-ld";
import { MarketingFaq } from "@/components/marketing-faq";
import { MarketingShell } from "@/components/marketing-shell";
import { getUseCase, USE_CASES } from "@/lib/use-cases";
import {
  breadcrumbLd,
  clipMetaDescription,
  faqPageLd,
  formatDisplayDate,
  marketingMetadata,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

type Params = { slug: string };

function pageUrl(slug: string): string {
  return `${SITE_URL}/use-cases/${slug}`;
}

export function generateStaticParams() {
  return USE_CASES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const uc = getUseCase(slug);
  if (!uc) return {};
  return marketingMetadata({
    title: `${uc.nameH1} — ${SITE_NAME}`,
    description: clipMetaDescription(uc.description),
    path: `/use-cases/${uc.slug}`,
  });
}

export default async function UseCasePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const uc = getUseCase(slug);
  if (!uc) notFound();

  const crumbs = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "Use cases", url: `${SITE_URL}/use-cases` },
    { name: uc.name, url: pageUrl(uc.slug) },
  ]);

  return (
    <MarketingShell wide>
      <JsonLd data={crumbs} />
      {faqPageLd(uc.faq) ? <JsonLd data={faqPageLd(uc.faq)} /> : null}

      <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-zinc-900">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/use-cases" className="hover:text-zinc-900">
              Use cases
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-zinc-700">{uc.name}</li>
        </ol>
      </nav>

      <p className="mt-6 text-sm font-medium uppercase tracking-widest text-teal-700">
        Use case
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-900">{uc.nameH1}</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-600">{uc.tagline}</p>
      <p className="mt-2 text-sm text-zinc-500">
        Updated {formatDisplayDate(uc.updated)}
      </p>

      <p className="mt-8 max-w-3xl text-base leading-relaxed text-zinc-700">{uc.intro}</p>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {uc.pains.map((p) => (
          <section key={p.title} className="rounded-2xl border border-zinc-200 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{p.body}</p>
          </section>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
          What Wingman does in that inbox
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {uc.scenes.map((s) => (
            <section key={s.title} className="rounded-2xl border border-zinc-200 p-6">
              <h3 className="font-semibold text-zinc-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{s.body}</p>
            </section>
          ))}
        </div>
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">What this is not</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700">
          {uc.notThis.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <MarketingFaq items={uc.faq} />

      <p className="mt-8 text-sm text-zinc-600">
        Comparing a named product?{" "}
        <Link href="/alternatives/fyxer" className="font-medium text-zinc-900 underline">
          Wingman vs Fyxer
        </Link>
        . Or see{" "}
        <Link href="/features" className="font-medium text-zinc-900 underline">
          all features
        </Link>{" "}
        and the{" "}
        <Link href="/use-cases" className="font-medium text-zinc-900 underline">
          use-cases index
        </Link>
        .
      </p>

      <ContentCta {...uc.cta} />
    </MarketingShell>
  );
}
