import type { FunnelStep } from "@/lib/funnel-data";

const FILLS = [
  "#0d9488",
  "#0891b2",
  "#0284c7",
  "#d97706",
  "#ea580c",
  "#e11d48",
  "#7c3aed",
  "#0f766e",
];

function pct(n: number, d: number) {
  if (!d) return null;
  return Math.round((n / d) * 1000) / 10;
}

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export function FunnelViz({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  const top = steps[0]?.value || 1;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-zinc-50 via-white to-teal-50/50 p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-teal-400/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-10 size-48 rounded-full bg-amber-400/10 blur-3xl"
      />

      <div className="relative mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700/80">
            Inbox Wingman
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
            14-day conversion funnel
          </h2>
        </div>
        <p className="hidden text-right text-xs text-zinc-500 sm:block">
          Visitors → paid
          <br />
          conversion path
        </p>
      </div>

      <div className="relative mx-auto max-w-xl" role="img" aria-label="Conversion funnel">
        {steps.map((step, i) => {
          const next = steps[i + 1];
          const widthPct = Math.max(18, (step.value / max) * 100);
          const nextPct = next
            ? Math.max(12, (next.value / max) * 100)
            : Math.max(12, widthPct * 0.55);
          const botInset = Math.max(0, ((widthPct - nextPct) / widthPct) * 50);
          const fill = FILLS[i % FILLS.length];
          const convert = next != null ? pct(next.value, step.value) : null;

          return (
            <div key={step.key}>
              <div className="grid grid-cols-[minmax(4.5rem,7.5rem)_1fr_minmax(2.75rem,4rem)] items-center gap-2 sm:gap-3">
                <p className="truncate text-right text-xs font-semibold text-zinc-700 sm:text-sm">
                  {step.label}
                </p>
                <div className="flex justify-center">
                  <div
                    className="h-12 w-full max-w-full shadow-sm sm:h-14"
                    style={{
                      width: `${widthPct}%`,
                      background: fill,
                      clipPath: `polygon(0 0, 100% 0, ${100 - botInset}% 100%, ${botInset}% 100%)`,
                    }}
                  />
                </div>
                <p className="text-left text-base font-bold tabular-nums text-zinc-900 sm:text-lg">
                  {fmt(step.value)}
                </p>
              </div>
              {convert != null && (
                <p className="py-1.5 text-center text-[11px] font-semibold text-zinc-500">
                  {convert}% convert
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((step, i) => {
          const prev = i > 0 ? steps[i - 1]!.value : null;
          const ofTop = pct(step.value, top);
          const stepPct = prev != null ? pct(step.value, prev) : null;
          return (
            <div
              key={`m-${step.key}`}
              className="rounded-lg border border-zinc-200/80 bg-white/80 px-3 py-2 backdrop-blur"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: FILLS[i % FILLS.length] }}
                />
                <p className="truncate text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  {step.label}
                </p>
              </div>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
                {fmt(step.value)}
              </p>
              <p className="text-[10px] text-zinc-500">
                {i === 0
                  ? "top of funnel"
                  : `${ofTop}% of visitors${stepPct != null ? ` · ${stepPct}% step` : ""}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
