import Link from "next/link";

const ATTESTATIONS = [
  {
    title: "Google Verified",
    status: "Branding + data access",
    body: "Google verified our OAuth branding and the gmail.modify data-access request. Use of Gmail data follows Limited Use.",
    href: "https://developers.google.com/terms/api-services-user-data-policy",
    external: true,
    icon: "google" as const,
  },
  {
    title: "CASA AL1",
    status: "In Compliance",
    body: "Lab-tested and lab-verified by TAC Security, an App Defense Alliance authorized lab. Assessed September 2026.",
    href: "https://appdefensealliance.dev/casa",
    external: true,
    icon: "casa" as const,
  },
  {
    title: "GDPR",
    status: "DPA + deletion",
    body: "EU-ready: legal bases, a signed DPA, sub-processor list, and delete-anytime. We do not sell your data.",
    href: "/dpa",
    external: false,
    icon: "gdpr" as const,
  },
];

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
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

function CasaMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
      <path
        fill="currentColor"
        className="text-teal-700"
        d="M16 4 6 8v7.2c0 6.1 4.1 11.8 10 13.3 5.9-1.5 10-7.2 10-13.3V8L16 4zm-1.2 16.4-4.3-4.3 1.6-1.6 2.7 2.7 5.3-5.3 1.6 1.6-6.9 6.9z"
      />
    </svg>
  );
}

function GdprMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
      <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-zinc-700" />
      <path
        fill="currentColor"
        className="text-zinc-700"
        d="M16 10.2a4.4 4.4 0 0 0-4.4 4.4v1.1h-.7v5.6h10.2v-5.6h-.7v-1.1A4.4 4.4 0 0 0 16 10.2zm0 1.6a2.8 2.8 0 0 1 2.8 2.8v1.1h-5.6v-1.1A2.8 2.8 0 0 1 16 11.8z"
      />
    </svg>
  );
}

function Mark({ icon }: { icon: (typeof ATTESTATIONS)[number]["icon"] }) {
  if (icon === "google") return <GoogleMark />;
  if (icon === "casa") return <CasaMark />;
  return <GdprMark />;
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
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-50 ring-1 ring-zinc-200">
                <Mark icon={item.icon} />
              </span>
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
