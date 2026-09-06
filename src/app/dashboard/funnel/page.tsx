import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFunnelAdmin } from "@/lib/funnel-admin";
import { loadWingmanFunnel } from "@/lib/funnel-data";
import { FunnelViz } from "./funnel-viz";

export const dynamic = "force-dynamic";

export default async function FunnelPage() {
  const session = await auth();
  if (!isFunnelAdmin(session?.user?.email)) redirect("/dashboard");

  const { steps, people, since } = await loadWingmanFunnel(14);

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
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium text-zinc-900">
                  {p.email ?? p.id.slice(0, 12)}
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
