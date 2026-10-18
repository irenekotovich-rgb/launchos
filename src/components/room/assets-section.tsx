import { EmptyState, Pill, Section } from "./section";
import type { Asset, AssetStatus, ConsistencyFinding, LaunchDoc } from "@/lib/types";

const STATUS: Record<AssetStatus, { label: string; tone: "good" | "warn" | "bad" | "info" }> = {
  ok: { label: "On brief", tone: "good" },
  draft: { label: "Draft", tone: "info" },
  stale: { label: "Drifted from brief", tone: "bad" },
  generating: { label: "Generating…", tone: "warn" },
};

function AssetCard({ asset, findings }: { asset: Asset; findings: ConsistencyFinding[] }) {
  const s = STATUS[asset.status];
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-background/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 break-words font-semibold">{asset.title}</h3>
        <Pill tone={s.tone}>{s.label}</Pill>
      </div>
      <p className="whitespace-pre-line break-words text-sm text-muted-foreground line-clamp-6">{asset.content}</p>
      {asset.content.length > 280 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-primary">Read the full draft</summary>
          <p className="mt-2 whitespace-pre-line break-words text-muted-foreground">{asset.content}</p>
        </details>
      )}
      <p className="text-xs font-medium text-warning">Draft — review before publishing</p>
      {findings.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Consistency check · {findings.length} finding{findings.length === 1 ? "" : "s"}
          </p>
          {findings.map((f) => (
            <div key={f.id} className="rounded-lg bg-destructive/10 p-3 text-sm">
              <div className="mb-1 flex flex-wrap gap-2">
                <Pill tone={f.severity === "high" ? "bad" : "warn"}>{f.severity}</Pill>
                <Pill tone="muted">{f.category}</Pill>
              </div>
              <p className="break-words">“{f.excerpt}”</p>
              <p className="mt-1 break-words text-muted-foreground">Brief: {f.briefReference}</p>
              <p className="mt-1 break-words text-success">Fix: {f.suggestion}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function AssetsSection({ doc }: { doc: LaunchDoc }) {
  const stale = doc.assets.filter((a) => a.status === "stale").length;
  return (
    <Section
      id="assets"
      title="Asset kit"
      kicker={doc.assets.length ? `${doc.assets.length} assets · ${stale} drifted` : "Not generated yet"}
    >
      {doc.assets.length === 0 ? (
        <EmptyState>
          The kit (release notes, blog post, announcement email, LinkedIn post, sales one-pager, FAQ) is generated from the
          brief in the asset phase. Every asset is then checked against the brief for drift.
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {doc.assets.map((a) => (
            <AssetCard key={a.id} asset={a} findings={doc.findings.filter((f) => f.assetId === a.id)} />
          ))}
        </div>
      )}
    </Section>
  );
}
