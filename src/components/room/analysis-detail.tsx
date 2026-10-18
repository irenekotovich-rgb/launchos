import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnalysisDetailEditors } from "./editors";
import { ANALYSIS_KEYS, ANALYSIS_LABELS } from "./analysis-section";
import { HighlightView } from "./infographic";
import { fmtDayYear } from "@/lib/format";
import type { AnalysisKey, LaunchDoc } from "@/lib/types";

/** Full page for one analysis field: the three facts large, the summary, evidence and open questions. */
export function AnalysisDetail({ doc, field, basePath, editable = false }: { doc: LaunchDoc; field: AnalysisKey; basePath: string; editable?: boolean }) {
  const f = doc.analysis.fields[field];
  const i = ANALYSIS_KEYS.indexOf(field);
  const prev = ANALYSIS_KEYS[(i + ANALYSIS_KEYS.length - 1) % ANALYSIS_KEYS.length];
  const next = ANALYSIS_KEYS[(i + 1) % ANALYSIS_KEYS.length];
  const facts = (f.highlights ?? []).slice(0, 3);
  return (
    <article className="flex flex-col gap-5">
      <Link href={`${basePath}#analysis`} className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {doc.brief.productName} · Analysis
      </Link>
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Analysis {i + 1} of 6</p>
        <h1 className="text-chrome text-4xl font-extrabold tracking-tight sm:text-6xl">{ANALYSIS_LABELS[field]}</h1>
        <p className="text-sm text-muted-foreground">
          {f.source === "ai-draft" ? <span className="font-semibold text-warning">AI draft — review before publishing</span> : "Written by the PMM"}
          {f.updatedAt && <> · updated {fmtDayYear(f.updatedAt)}</>}
        </p>
      </header>

      {facts.length > 0 ? (
        <dl className="grid gap-3 sm:grid-cols-3">
          {facts.map((h, j) => (
            <div key={j} className={j === 0 ? "surface-burgundy rounded-3xl p-6" : "surface rounded-3xl p-6"}>
              <HighlightView h={h} size="lg" onMetal={j === 0} />
            </div>
          ))}
        </dl>
      ) : (
        <p className="surface rounded-3xl p-6 text-muted-foreground">No key facts yet.</p>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <section className="surface rounded-3xl p-6" aria-labelledby="summary-h">
          <h2 id="summary-h" className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Summary</h2>
          <p className="whitespace-pre-line break-words">{f.text.trim() || "Not written yet."}</p>
        </section>
        <section className="surface rounded-3xl p-6" aria-labelledby="points-h">
          <h2 id="points-h" className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Evidence & open questions</h2>
          {f.points?.length ? (
            <ul className="flex flex-col gap-2">
              {f.points.map((p, j) => (
                <li key={j} className="flex gap-3 break-words">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span className={/^(needs your input|to confirm)/i.test(p) ? "text-warning" : ""}>{p}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No points yet.</p>
          )}
        </section>
      </div>

      {editable && <AnalysisDetailEditors field={field} />}

      <nav aria-label="Other analysis areas" className="flex flex-wrap justify-between gap-3">
        <Link href={`${basePath}/analysis/${prev}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> {ANALYSIS_LABELS[prev]}
        </Link>
        <Link href={`${basePath}/analysis/${next}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {ANALYSIS_LABELS[next]} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </nav>
    </article>
  );
}
