import Image from "next/image";
import Link from "next/link";

const ATTESTATIONS = [
  {
    title: "Google Verified",
    status: "Branding + data access",
    body: "Google verified our OAuth branding and the gmail.modify data-access request. Use of Gmail data follows Limited Use.",
    href: "https://developers.google.com/terms/api-services-user-data-policy",
    external: true,
    image: null,
  },
  {
    title: "CASA Tier 2 AL1",
    status: "In Compliance",
    body: "Lab-tested and lab-verified by TAC Security, an App Defense Alliance authorized lab. Assessed September 2026.",
    href: "https://appdefensealliance.dev/casa",
    external: true,
    image: { src: "/badges/casa-tier2-al1.webp", alt: "CASA Tier 2 AL1 Verified" },
  },
  {
    title: "GDPR",
    status: "DPA + deletion",
    body: "EU-ready: legal bases, a signed DPA, sub-processor list, and delete-anytime. We do not sell your data.",
    href: "/dpa",
    external: false,
    image: { src: "/badges/gdpr.jpg", alt: "GDPR" },
  },
] as const;

function GoogleMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function Seal({
  item,
  size,
}: {
  item: (typeof ATTESTATIONS)[number];
  size: "card" | "strip";
}) {
  if (item.image) {
    const px = size === "card" ? 80 : 20;
    return (
      <Image
        src={item.image.src}
        alt={item.image.alt}
        width={px}
        height={px}
        className={size === "card" ? "h-20 w-20 object-contain" : "h-5 w-5 object-contain"}
      />
    );
  }
  if (size === "card") {
    return (
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-50 ring-1 ring-zinc-200">
        <GoogleMark className="h-9 w-9" />
      </span>
    );
  }
  return <GoogleMark className="h-3.5 w-3.5" />;
}

/** Compact pills for the footer and other tight spots. */
export function SecurityBadgeStrip({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`}>
      {ATTESTATIONS.map((item) => (
        <li key={item.title}>
          <Link
            href="/security"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:text-zinc-900"
          >
            <Seal item={item} size="strip" />
            {item.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SecurityAttestations() {
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {ATTESTATIONS.map((item) => {
        const className =
          "flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:border-zinc-300";
        const inner = (
          <>
            <div className="flex items-start justify-between gap-3">
              <Seal item={item} size="card" />
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-800">
                {item.status}
              </span>
            </div>
            <p className="mt-4 text-base font-semibold text-zinc-900">{item.title}</p>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-zinc-600">{item.body}</p>
            <p className="mt-3 text-xs font-medium text-teal-800">
              {item.external ? "Learn more →" : "Read the DPA →"}
            </p>
          </>
        );

        return (
          <li key={item.title}>
            {item.external ? (
              <a href={item.href} target="_blank" rel="noreferrer" className={className}>
                {inner}
              </a>
            ) : (
              <Link href={item.href} className={className}>
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
