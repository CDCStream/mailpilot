import Link from "next/link";

/** Single product CTA box used at the bottom of blog articles and free tools. */
export function ContentCta({
  headline,
  body,
  href,
  label,
}: {
  headline: string;
  body: string;
  href: string;
  label: string;
}) {
  return (
    <div className="mt-12 rounded-2xl bg-zinc-900 p-8 text-center">
      <h2 className="text-xl font-bold tracking-tight text-white">{headline}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-zinc-300">{body}</p>
      <Link
        href={href}
        className="mt-5 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
      >
        {label}
      </Link>
    </div>
  );
}
