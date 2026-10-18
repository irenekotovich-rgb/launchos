import { ExpectedEditors } from "./editors";
import type { Impact, LaunchDoc } from "@/lib/types";

function money(i: Impact) {
  return new Intl.NumberFormat("en", { style: "currency", currency: i.currency || "USD", notation: "compact", maximumFractionDigits: 1 }).format(i.amount);
}

/** Expected results: what the user experiences, and what it does to the company's money. */
export function ExpectedResults({ doc, editable = false }: { doc: LaunchDoc; editable?: boolean }) {
  const e = doc.alignment.expected;
  const rev = e?.revenue ?? null;
  const exp = e?.expenses ?? null;
  const max = Math.max(rev?.amount ?? 0, exp?.amount ?? 0, 1);
  const sameCurrency = rev && exp && rev.currency === exp.currency;
  const net = rev && exp && sameCurrency ? { ...rev, amount: rev.amount - exp.amount } : null;
  const roi = rev && exp && sameCurrency && exp.amount > 0 ? rev.amount / exp.amount : null;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-background/40 p-5">
        <h3 className="mb-3 font-semibold">Expected results · for the user</h3>
        {e?.userExperience.length ? (
          <ol className="flex flex-col gap-3">
            {e.userExperience.map((line, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/25 bg-secondary">
                  <span className="text-chrome text-sm font-extrabold">{i + 1}</span>
                </span>
                <span className="break-words pt-0.5">{line}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Not described yet.</p>
        )}
      </div>

      <div className="surface-burgundy rounded-2xl p-5 text-white">
        <h3 className="mb-3 font-semibold">Company impact</h3>
        {rev || exp ? (
          <div className="flex flex-col gap-4">
            <dl className="flex flex-col gap-3">
              {[
                { label: "Revenue increase", i: rev, bar: "bg-white" },
                { label: "Expenses increase", i: exp, bar: "bg-white/55" },
              ].map(({ label, i, bar }) => (
                <div key={label} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm">{label}</dt>
                    <dd className="text-xl font-extrabold tabular-nums">{i ? `+${money(i)}` : "—"}</dd>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-black/40" aria-hidden>
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${i ? (i.amount / max) * 100 : 0}%` }} />
                  </div>
                  {i && <p className="text-xs">{i.period}{i.note && ` · ${i.note}`}</p>}
                </div>
              ))}
            </dl>
            {net && (
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-black/40 p-3">
                <div>
                  <p className="text-xs uppercase tracking-widest">Net</p>
                  <p className="text-3xl font-extrabold tabular-nums">{net.amount >= 0 ? "+" : "−"}{money({ ...net, amount: Math.abs(net.amount) })}</p>
                </div>
                {roi !== null && (
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-widest">Return</p>
                    <p className="text-3xl font-extrabold tabular-nums">{roi.toFixed(1)}×</p>
                  </div>
                )}
              </div>
            )}
            <p className="text-xs">Agreed estimate — a hypothesis to validate, not a forecast of record.</p>
          </div>
        ) : (
          <p className="text-sm">Revenue and expense impact not estimated yet.</p>
        )}
      </div>
      {editable && !doc.alignment.lockedAt && <ExpectedEditors />}
    </div>
  );
}
