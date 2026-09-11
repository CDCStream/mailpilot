import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFunnelAdmin } from "@/lib/funnel-admin";
import { loadFunnelJourney } from "@/lib/funnel-data";

export const dynamic = "force-dynamic";

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function FunnelPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!isFunnelAdmin(session?.user?.email)) redirect("/dashboard");

  const { id: raw } = await params;
  const personId = decodeURIComponent(raw);
  const journey = await loadFunnelJourney(personId, 14);
  if (!journey) notFound();

  const { person, events } = journey;
  const title = person.email ?? (person.kind === "anon" ? "Anonymous visitor" : "Signed-up user");
  const flags = [
    `${events.length} event${events.length === 1 ? "" : "s"}`,
    person.signedUp || person.kind === "user" ? "signed up" : "not signed up",
    "last 14 days",
  ];

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <Link
        href="/dashboard/funnel"
        className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
      >
        ← Funnel
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-zinc-900">{title}</h1>
      <p className="mt-1 break-all font-mono text-xs text-zinc-400">
        {person.kind === "anon" ? person.id.replace(/^anon:/, "") : person.id}
      </p>
      <p className="mt-2 text-sm text-zinc-500">{flags.join(" · ")}</p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900">Journey</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {person.kind === "anon"
            ? "Pre-signup page views and CTA clicks for this browser (anon id)."
            : "Page views and product events for this account, oldest first."}
        </p>

        {events.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">No events in the last 14 days.</p>
        ) : (
          <ol className="mt-6 space-y-3">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                    Event
                  </span>
                  <span className="font-medium text-zinc-900">{ev.event}</span>
                  {ev.path ? (
                    <span className="font-mono text-sm text-zinc-500">{ev.path}</span>
                  ) : null}
                </div>
                {ev.properties && Object.keys(ev.properties).length > 0 ? (
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {Object.entries(ev.properties).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600"
                      >
                        {k}: {String(v)}
                      </span>
                    ))}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-zinc-400">{when(ev.createdAt)}</p>
                {ev.referrer ? (
                  <p className="mt-0.5 truncate text-xs text-zinc-400">from {ev.referrer}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
