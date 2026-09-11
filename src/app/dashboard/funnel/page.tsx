import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFunnelAdmin } from "@/lib/funnel-admin";
import { loadWingmanFunnel } from "@/lib/funnel-data";
import { FunnelViz } from "./funnel-viz";

export const dynamic = "force-dynamic";

export default async function FunnelPage() {
  const session = await auth();
  if (!isFunnelAdmin(session?.user?.email)) redirect("/dashboard");

  const { steps, onboardingSteps, people, since } = await loadWingmanFunnel(14);
  const onbTop = onboardingSteps[0]?.value ?? 0;

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Admin</p>
      <h1 className="mt-1 text-2xl font-bold">Funnel</h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-500">
        Last 14 days · first-party events · your account is excluded from counts. Since{" "}
        {new Date(since).toLocaleDateString("en-US")}.
      </p>

      <div className="mt-8">
        <FunnelViz steps={steps} />
      </div>

      <section className="mt-10 rounded-2xl border border-zinc-200 p-6">
        <h2 className="text-lg font-semibold">Onboarding drop-off</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Highest wizard step reached per person (last 14 days). Steps: persona → inbox mode →
          voice → setup.
        </p>
        {onbTop === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No onboarding-step events yet — they start recording with the next signup.
          </p>
        ) : (
          <div className="mt-5 grid gap-2 sm:grid-cols-5">
            {onboardingSteps.map((s, i) => {
              const prev = i > 0 ? onboardingSteps[i - 1]!.value : null;
              const lostHere = prev != null ? prev - s.value : 0;
              return (
                <div key={s.key} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                  <p className="truncate text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    {s.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
                    {s.value}
                  </p>
                  {prev != null && (
                    <p className={`text-xs ${lostHere > 0 ? "text-rose-600" : "text-zinc-400"}`}>
                      {lostHere > 0 ? `−${lostHere} dropped` : "no loss"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-10 overflow-x-auto rounded-2xl border border-zinc-200">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Identity</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Gmail</th>
              <th className="px-4 py-3 font-medium">Draft</th>
              <th className="px-4 py-3 font-medium">Paid</th>
              <th className="px-4 py-3 font-medium">Last path</th>
              <th className="px-4 py-3 font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {people.slice(0, 200).map((p) => (
              <tr key={p.id} className="relative cursor-pointer hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900">
                  <Link
                    href={`/dashboard/funnel/${encodeURIComponent(p.id)}`}
                    className="after:absolute after:inset-0"
                  >
                    {p.email ?? p.id.slice(0, 12)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-500">{p.kind}</td>
                <td className="px-4 py-3 text-zinc-500">{p.gmail ? "yes" : "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{p.drafted ? "yes" : "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{p.paid ? p.plan ?? "yes" : "—"}</td>
                <td className="max-w-xs truncate px-4 py-3 text-zinc-500">{p.lastPath ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-500">
                  {p.lastAt ? new Date(p.lastAt).toLocaleString("en-US") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
