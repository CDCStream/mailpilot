import type { FaqItem } from "@/lib/seo";

export function MarketingFaq({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null;
  return (
    <section id="faq" className="mt-16">
      <h2 className="text-2xl font-bold tracking-tight text-zinc-900">FAQ</h2>
      <div className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200">
        {items.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-zinc-900 marker:content-none [&::-webkit-details-marker]:hidden">
              {item.q}
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg font-normal text-zinc-400 transition group-open:bg-teal-100 group-open:text-teal-800"
              >
                <span className="group-open:hidden">+</span>
                <span className="hidden group-open:inline">×</span>
              </span>
            </summary>
            <p className="mt-3 pr-10 text-sm leading-relaxed text-zinc-600">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
