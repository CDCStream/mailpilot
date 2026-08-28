"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type KeyRow = { id: string; name: string; prefix: string; createdAt: string };

export function ApiKeysPanel({
  keys,
  bonusCredits,
  justGranted,
}: {
  keys: KeyRow[];
  bonusCredits: number;
  justGranted: number;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [granted, setGranted] = useState<number | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSecret(null);
    setGranted(null);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        granted?: number;
        key?: { secret?: string };
      } | null;
      if (!res.ok || data?.ok === false) {
        setError(data?.error ?? "Could not create key");
        return;
      }
      setSecret(data?.key?.secret ?? null);
      setGranted(typeof data?.granted === "number" ? data.granted : 0);
      setName("");
      router.refresh();
    } catch {
      setError("Could not create key");
    } finally {
      setBusy(false);
    }
  }

  async function onRename(id: string, nextName: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: nextName }),
      });
      if (!res.ok) setError("Could not rename key");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    try {
      await fetch("/api/settings/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 p-6">
      <h2 className="font-semibold">API keys</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Create a named key. The secret is shown once. A matching promo name credits your
        account only on the first create — later keys or renames do not add credits again.
        Top-up wallet now: {bonusCredits.toLocaleString("en-US")} credits.
      </p>
      {justGranted > 0 && (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {justGranted.toLocaleString("en-US")} bonus credits were just added for your existing
          promo key.
        </p>
      )}

      <form onSubmit={(e) => void onCreate(e)} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Key name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            placeholder="e.g. FuatSezer_1000"
            className="w-64 rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-70"
        >
          {busy ? "Creating…" : "Create API key"}
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      )}
      {granted != null && granted > 0 && (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {granted.toLocaleString("en-US")} bonus credits added to your account. This promo
          will not grant again.
        </p>
      )}
      {granted === 0 && secret && (
        <p className="mt-3 text-xs text-zinc-500">Key created. No extra credits on this name.</p>
      )}
      {secret && (
        <p className="mt-3 break-all rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800">
          {secret}
          <span className="mt-1 block font-sans text-zinc-500">Copy now — it will not be shown again.</span>
        </p>
      )}

      {keys.length > 0 && (
        <ul className="mt-5 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <form
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const next = String(new FormData(e.currentTarget).get("name") ?? "");
                  void onRename(k.id, next);
                }}
              >
                <input
                  name="name"
                  defaultValue={k.name}
                  maxLength={80}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-2 py-1 text-sm"
                />
                <span className="font-mono text-xs text-zinc-400">{k.prefix}…</span>
                <button
                  type="submit"
                  disabled={busy}
                  className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                >
                  Save name
                </button>
              </form>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onDelete(k.id)}
                className="text-xs text-rose-600 hover:text-rose-800"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
