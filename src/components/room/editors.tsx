"use client";

// Inline editors for own launches. Each one applies a pure edit from lib/edit.ts through the
// LaunchEditor context; the owner component persists the result. The demo never renders these.

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { Check, Circle, Loader2, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { briefKey, regenerateAsset, runConsistencyCheck } from "@/lib/ai-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import * as E from "@/lib/edit";
import { METRIC_LIMITS } from "@/lib/types";
import { stageGate } from "@/lib/launch-status";
import * as R from "@/lib/rollout-edit";
import { emailsInSnapshot, exportFileName, SHARE_TTL_DAYS, toExportFile } from "@/lib/share";
import { setShareInfo } from "@/lib/edit";
import { fmtDayYear } from "@/lib/format";
import type { AnalysisKey, AssetType, Highlight, Impact, LaunchBrief, LaunchDoc, Metric, PhaseKey, Recipient, RolloutPercent, TeamKey, TeamSignoff } from "@/lib/types";
import { cn } from "@/lib/utils";

type Apply = (edit: (doc: LaunchDoc, now: Date) => LaunchDoc) => void;
type AiTask = () => ReturnType<typeof runConsistencyCheck>;
interface EditorCtx {
  doc: LaunchDoc;
  apply: Apply;
  /** Which AI task is running (one at a time per launch), and how to run one. */
  aiBusy: string | null;
  runAi: (key: string, task: AiTask, opts: { staleOnBriefChange: "discard" | "keep-stale" }) => Promise<string | null>;
}
const Ctx = createContext<EditorCtx | null>(null);

export function LaunchEditor({ doc, onChange, children }: { doc: LaunchDoc; onChange: (d: LaunchDoc) => void; children: React.ReactNode }) {
  // Edits chain off the latest doc, so two edits in one tick (e.g. blur + click) don't drop one.
  const latest = useRef(doc);
  latest.current = doc;
  const apply: Apply = (edit) => {
    const next = edit(latest.current, new Date());
    if (next === latest.current) return;
    latest.current = next;
    onChange(next);
  };
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);
  /**
   * Runs one AI task and applies its result to the *latest* doc. If the brief changed while the
   * task ran, a check is discarded and a regenerated asset is kept but marked stale.
   * Resolves to a user-facing message (or null on success).
   */
  const runAi: EditorCtx["runAi"] = async (key, task, { staleOnBriefChange }) => {
    if (aiBusy) return "Another AI task is running — wait for it to finish.";
    setAiBusy(key);
    const res = await task();
    if (!mounted.current) return null;
    setAiBusy(null);
    if (!res.ok) return res.message;
    if (briefKey(latest.current) !== res.brief) {
      if (staleOnBriefChange === "discard") return "The brief changed while checking — run the check again.";
      apply((d, now) => {
        const next = res.edit(d, now);
        return { ...next, assets: next.assets.map((a) => (a.generatedAt === now.toISOString() ? { ...a, status: "stale" as const } : a)) };
      });
      return "Regenerated, but the brief changed meanwhile — it's marked stale.";
    }
    apply(res.edit);
    return null;
  };
  return <Ctx.Provider value={{ doc, apply, aiBusy, runAi }}>{children}</Ctx.Provider>;
}

function useEditor() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Editor components must be inside <LaunchEditor>");
  return ctx;
}

const iconBtn = "grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground";

/** Returns focus to `ref` after the editor closes (the trigger re-mounts, so focus would drop to <body>). */
function useReturnFocus(open: boolean) {
  const ref = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) ref.current?.focus();
    wasOpen.current = open;
  }, [open]);
  return ref;
}

/** Click-to-edit text with explicit Save / Cancel; Enter saves single-line fields, Escape cancels. */
export function InlineText({
  value,
  label,
  placeholder,
  multiline = true,
  maxLength = 1200,
  onSave,
}: {
  value: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  onSave: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const trigger = useReturnFocus(editing);
  const id = useId();
  const verb = value ? "Edit" : "Add";
  if (!editing) {
    return (
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline"
        aria-label={`${verb} ${label}`}
      >
        <Pencil className="size-3.5" aria-hidden /> {verb}
      </button>
    );
  }
  const Field = multiline ? Textarea : Input;
  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft.trim());
        setEditing(false);
      }}
    >
      <label htmlFor={id} className="sr-only">{label}</label>
      <Field
        id={id}
        value={draft}
        autoFocus
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setDraft(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setEditing(false);
          }
        }}
        {...(multiline ? { rows: 3 } : {})}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm">Save</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </form>
  );
}

export function ChecklistToggle({ id, done, label }: { id: string; done: boolean; label: string }) {
  const { apply } = useEditor();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={() => apply((d, now) => E.toggleChecklist(d, id, now))}
      className={cn(iconBtn, "-m-2")}
    >
      {done ? <Check className="size-4 text-success" aria-hidden /> : <Circle className="size-4" aria-hidden />}
    </button>
  );
}

export function AnalysisEditor({ field, label }: { field: AnalysisKey; label: string }) {
  const { doc, apply } = useEditor();
  return (
    <InlineText
      value={doc.analysis.fields[field].text}
      label={label}
      onSave={(t) => apply((d, now) => E.setAnalysisField(d, field, t, now))}
    />
  );
}

export function AlignmentTextEditor({ field, label }: { field: "problem" | "forWhom"; label: string }) {
  const { doc, apply } = useEditor();
  if (doc.alignment.lockedAt) return null;
  return <InlineText value={doc.alignment[field]} label={label} onSave={(t) => apply((d, now) => E.setAlignmentText(d, field, t, now))} />;
}

export function MetricRemove({ metric }: { metric: Metric }) {
  const { doc, apply } = useEditor();
  if (doc.alignment.lockedAt) return null;
  return (
    <button type="button" className={iconBtn} aria-label={`Remove metric ${metric.name}`} onClick={() => apply((d, now) => E.removeMetric(d, metric.id, now))}>
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}

export function MetricForm({ kind }: { kind: Metric["kind"] }) {
  const { doc, apply } = useEditor();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", unit: "", direction: "above" as Metric["direction"], threshold: "", owner: "" });
  const trigger = useReturnFocus(open);
  const id = useId();
  if (doc.alignment.lockedAt) return null;
  if (doc.alignment.metrics.filter((m) => m.kind === kind).length >= METRIC_LIMITS[kind]) return null;
  if (!open) {
    return (
      <button ref={trigger} type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline">
        <Plus className="size-3.5" aria-hidden /> Add {kind} metric
      </button>
    );
  }
  const threshold = Number(f.threshold);
  const valid = f.name.trim() && f.owner.trim() && f.threshold.trim() !== "" && Number.isFinite(threshold);
  return (
    <form
      className="mt-3 grid gap-2 rounded-lg border border-border p-3"
      aria-label={`New ${kind} metric`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setOpen(false);
        }
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        apply((d, now) => E.upsertMetric(d, { kind, name: f.name.trim(), unit: f.unit.trim(), direction: f.direction, threshold, owner: f.owner.trim() }, now));
        setF({ name: "", unit: "", direction: "above", threshold: "", owner: "" });
        setOpen(false);
      }}
    >
      <label className="text-xs font-semibold" htmlFor={`${id}-name`}>Metric name</label>
      <Input id={`${id}-name`} autoFocus value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={kind === "success" ? "Workspaces using the feature" : "Support tickets per 1k workspaces"} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" htmlFor={`${id}-dir`}>{kind === "success" ? "Target is" : "Fails when"}</label>
          <select id={`${id}-dir`} value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value as Metric["direction"] })} className="h-8 rounded-lg border border-input bg-input/30 px-2 text-sm">
            <option value="above">≥ (at or above)</option>
            <option value="below">≤ (at or below)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" htmlFor={`${id}-thr`}>Threshold</label>
          <Input id={`${id}-thr`} inputMode="decimal" value={f.threshold} onChange={(e) => setF({ ...f, threshold: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" htmlFor={`${id}-unit`}>Unit</label>
          <Input id={`${id}-unit`} value={f.unit} maxLength={20} placeholder="%, h, ms…" onChange={(e) => setF({ ...f, unit: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" htmlFor={`${id}-owner`}>Owner</label>
          <Input id={`${id}-owner`} value={f.owner} maxLength={80} onChange={(e) => setF({ ...f, owner: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!valid} aria-describedby={`${id}-hint`}>Add metric</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">Name, numeric threshold and owner are required.</p>
    </form>
  );
}

export function SignoffEditor({ team, label }: { team: TeamKey; label: string }) {
  const { doc, apply } = useEditor();
  const s = doc.alignment.signoffs[team];
  const id = useId();
  if (doc.alignment.lockedAt) return null;
  const set = (patch: Partial<TeamSignoff>) => apply((d, now) => E.setSignoff(d, team, patch, now));
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex gap-2">
        <label htmlFor={`${id}-lead`} className="sr-only">{label} lead</label>
        <Input
          key={`lead-${s.lead}`}
          id={`${id}-lead`}
          defaultValue={s.lead}
          placeholder="Lead name"
          maxLength={80}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          onBlur={(e) => e.target.value.trim() !== s.lead && set({ lead: e.target.value.trim() })}
        />
        <label htmlFor={`${id}-status`} className="sr-only">{label} status</label>
        <select id={`${id}-status`} value={s.status} onChange={(e) => set({ status: e.target.value as TeamSignoff["status"] })} className="h-8 rounded-lg border border-input bg-input/30 px-2 text-sm">
          <option value="pending">pending</option>
          <option value="signed">signed</option>
          <option value="objected">objected</option>
        </select>
      </div>
      <label htmlFor={`${id}-note`} className="sr-only">{label} note</label>
      <Input
        key={`note-${s.note}`}
        id={`${id}-note`}
        defaultValue={s.note}
        placeholder="Note (optional) — Enter to save"
        maxLength={200}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        onBlur={(e) => e.target.value.trim() !== s.note && set({ note: e.target.value.trim() })}
      />
    </div>
  );
}

export function LockAlignment() {
  const { doc, apply } = useEditor();
  if (doc.alignment.lockedAt) return null;
  const blockers = E.lockBlockers(doc);
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <Button className="self-start" disabled={blockers.length > 0} onClick={() => apply((d, now) => E.lockAlignment(d, now))}>
        Lock alignment
      </Button>
      {blockers.length > 0 && (
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          {blockers.map((b) => <li key={b}>{b}</li>)}
        </ul>
      )}
    </div>
  );
}

export function ClosePhase({ phase, name }: { phase: PhaseKey; name: string }) {
  const { doc, apply } = useEditor();
  const p = doc.phases.find((x) => x.key === phase);
  if (!p || p.completedAt) return null;
  const current = doc.phases.find((x) => !x.completedAt);
  if (current?.key !== phase) return null;
  return (
    <Button size="sm" variant="outline" onClick={() => apply((d, now) => E.completePhase(d, phase, now))}>
      Close {name}
    </Button>
  );
}

export function DecisionComposer() {
  const { apply } = useEditor();
  const [text, setText] = useState("");
  const id = useId();
  return (
    <form
      className="mb-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        apply((d, now) => E.logDecision(d, text.trim(), now));
        setText("");
      }}
    >
      <label htmlFor={id} className="sr-only">New decision</label>
      <Input id={id} value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="Log a decision in one line…" />
      <Button type="submit" size="sm" className="h-8" disabled={!text.trim()}>Log</Button>
    </form>
  );
}

export function DecisionEdit({ id, text }: { id: string; text: string }) {
  const { apply } = useEditor();
  const snippet = text.length > 40 ? `${text.slice(0, 40)}…` : text;
  return <InlineText value={text} label={`decision "${snippet}"`} multiline={false} maxLength={300} onSave={(t) => apply((d, now) => E.editDecision(d, id, t, now))} />;
}

export function RecipientForm() {
  const { apply } = useEditor();
  const { doc } = useEditor();
  const [r, setR] = useState<Recipient>({ name: "", role: "", email: "", group: "team-lead" });
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const valid = r.name.trim() && E.isEmail(r.email.trim());
  return (
    <>
    <form
      className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1.3fr_auto_auto]"
      aria-describedby={`${id}-msg`}
      onSubmit={(e) => {
        e.preventDefault();
        const check = E.checkRecipient(doc, r.email);
        if (!r.name.trim() || check !== "ok") {
          setError(!r.name.trim() ? "Add a name." : check === "duplicate" ? "That email is already on the list." : "Enter a valid email.");
          return;
        }
        apply((d, now) => E.addRecipient(d, { ...r, name: r.name.trim(), role: r.role.trim(), email: r.email }, now));
        setR({ name: "", role: "", email: "", group: r.group });
        setError(null);
        nameRef.current?.focus();
      }}
    >
      <label className="sr-only" htmlFor={`${id}-n`}>Name</label>
      <Input ref={nameRef} id={`${id}-n`} value={r.name} placeholder="Name" maxLength={80} onChange={(e) => setR({ ...r, name: e.target.value })} />
      <label className="sr-only" htmlFor={`${id}-r`}>Role</label>
      <Input id={`${id}-r`} value={r.role} placeholder="Role" maxLength={80} onChange={(e) => setR({ ...r, role: e.target.value })} />
      <label className="sr-only" htmlFor={`${id}-e`}>Email</label>
      <Input id={`${id}-e`} type="email" value={r.email} placeholder="Email" maxLength={120} onChange={(e) => setR({ ...r, email: e.target.value })} />
      <label className="sr-only" htmlFor={`${id}-g`}>Group</label>
      <select id={`${id}-g`} value={r.group} onChange={(e) => setR({ ...r, group: e.target.value as Recipient["group"] })} className="h-8 rounded-lg border border-input bg-input/30 px-2 text-sm">
        <option value="team-lead">Team lead</option>
        <option value="stakeholder">Stakeholder</option>
      </select>
      <Button type="submit" size="sm" className="h-8" aria-disabled={!valid}>Add</Button>
    </form>
    <p id={`${id}-msg`} className="mt-1 text-xs text-warning empty:hidden" aria-live="polite">{error ?? ""}</p>
    </>
  );
}

export function RecipientRemove({ email, name }: { email: string; name: string }) {
  const { apply } = useEditor();
  return (
    <button type="button" className="-my-1 ml-1 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove ${name} (${email})`} onClick={() => apply((d, now) => E.removeRecipient(d, email, now))}>
      <Trash2 className="size-3.5" aria-hidden />
    </button>
  );
}

const BRIEF_TEXT: Record<"what" | "who" | "whyNow", { label: string; max: number }> = {
  what: { label: "what ships", max: 400 },
  who: { label: "who it's for", max: 300 },
  whyNow: { label: "why now", max: 400 },
};

export function BriefTextEditor({ field }: { field: keyof typeof BRIEF_TEXT }) {
  const { doc, apply } = useEditor();
  const meta = BRIEF_TEXT[field];
  return (
    <InlineText
      value={doc.brief[field]}
      label={meta.label}
      maxLength={meta.max}
      onSave={(t) => t && apply((d, now) => E.editBrief(d, { [field]: t } as Partial<LaunchBrief>, now))}
    />
  );
}

export function ClaimsEditor() {
  const { doc, apply } = useEditor();
  return (
    <InlineText
      value={doc.brief.claims.join("\n")}
      label="claims, one per line"
      maxLength={8 * 300}
      onSave={(t) => {
        // Same limits as the brief form/API: up to 8 claims, 300 characters each.
        const claims = t.split("\n").map((c) => c.trim().slice(0, 300)).filter(Boolean).slice(0, 8);
        if (claims.length) apply((d, now) => E.editBrief(d, { claims }, now));
      }}
    />
  );
}

/** Toolbar over the asset kit: run the rubric, generate what's missing. */
export function AssetActions({ missing }: { missing: { type: AssetType; label: string }[] }) {
  const { doc, aiBusy, runAi } = useEditor();
  const [message, setMessage] = useState<string | null>(null);
  const hasAssets = doc.assets.some((a) => a.content);
  const go = async (key: string, task: AiTask, mode: "discard" | "keep-stale") => {
    setMessage(null);
    setMessage(await runAi(key, task, { staleOnBriefChange: mode }));
  };
  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!hasAssets || aiBusy !== null} onClick={() => go("check", () => runConsistencyCheck(doc), "discard")}>
          {aiBusy === "check" ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />} Run consistency check
        </Button>
        {missing.map((m) => (
          <Button key={m.type} size="sm" variant="outline" disabled={aiBusy !== null} onClick={() => go(m.type, () => regenerateAsset(doc, m.type), "keep-stale")}>
            {aiBusy === m.type ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Generate {m.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {aiBusy === "check"
          ? "Checking every asset against the brief on the fixed rubric…"
          : aiBusy
            ? "Generating from the brief and messaging block…"
            : message ?? "The check compares claims, numbers, feature names and tone with the brief. Same rubric every run; tone notes are advisory."}
      </p>
    </div>
  );
}

export function RegenerateAsset({ type, title }: { type: AssetType; title: string }) {
  const { doc, aiBusy, runAi } = useEditor();
  const [message, setMessage] = useState<string | null>(null);
  const busy = aiBusy === `regen-${type}`;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={aiBusy !== null}
        onClick={async () => {
          setMessage(null);
          setMessage(await runAi(`regen-${type}`, () => regenerateAsset(doc, type), { staleOnBriefChange: "keep-stale" }));
        }}
        className="inline-flex min-h-8 items-center gap-1 self-start text-xs font-semibold text-primary hover:underline disabled:opacity-60"
        aria-label={`Regenerate ${title}`}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />} {busy ? "Regenerating…" : "Regenerate from brief"}
      </button>
      <p className="text-xs text-warning empty:hidden" aria-live="polite">{message ?? ""}</p>
    </div>
  );
}

// ---------------------------------------------------------------- rollout

/** Editor context if present (own launch), else null (demo) — for components used in both. */
export function useOptionalEditor() {
  return useContext(Ctx);
}

export function StageControls({ cumulative }: { cumulative: RolloutPercent }) {
  const { doc, apply } = useEditor();
  const stage = doc.rollout.stages.find((s) => s.cumulative === cumulative)!;
  const [mode, setMode] = useState<"idle" | "override" | "halt">("idle");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const id = useId();
  const gate = stage.status === "live" ? stageGate(doc, stage, new Date()) : null;
  const close = () => {
    setMode("idle");
    setReason("");
  };

  if (stage.status === "not-started") {
    return R.canStart(doc, cumulative) ? (
      <Button size="sm" variant="outline" className="self-start" onClick={() => apply((d, now) => R.startStage(d, cumulative, now))}>
        Start {cumulative}% stage
      </Button>
    ) : null;
  }
  if (stage.status === "halted") {
    return (
      <Button size="sm" variant="outline" className="self-start" onClick={() => apply((d, now) => R.resumeStage(d, cumulative, now))}>
        Resume stage
      </Button>
    );
  }
  if (stage.status !== "live") return null;

  if (mode !== "idle") {
    const label = mode === "override" ? "Why close despite the failing gate? (stage is marked overridden)" : "Why halt this stage?";
    return (
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!reason.trim()) return;
          apply((d, now) => (mode === "override" ? R.completeStage(d, cumulative, now, reason) : R.haltStage(d, cumulative, reason, now)));
          close();
        }}
        onKeyDown={(e) => e.key === "Escape" && close()}
      >
        <label htmlFor={id} className="text-xs font-semibold">{label}</label>
        <Input id={id} autoFocus value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Logged as a decision" />
        <div className="flex gap-2">
          <Button type="submit" size="sm" variant={mode === "halt" ? "destructive" : "default"} disabled={!reason.trim()}>
            {mode === "override" ? "Override and close" : "Halt stage"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={close}>Cancel</Button>
        </div>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {gate?.passes ? (
        <Button
          size="sm"
          onClick={() => {
            // Re-check at click time: a reading can go stale between render and click.
            if (!stageGate(doc, stage, new Date()).passes) {
              setNote("The gate stopped passing (a reading went stale). Record new readings or close with override.");
              return;
            }
            setNote(null);
            apply((d, now) => R.completeStage(d, cumulative, now));
          }}
        >
          {cumulative === 100 ? "Complete — rolled out to 100%" : `Complete ${cumulative}% stage`}
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setMode("override")}>Close with override…</Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => setMode("halt")}>Halt…</Button>
      <p className="w-full text-xs text-warning empty:hidden" aria-live="polite">{note ?? ""}</p>
    </div>
  );
}

export function ReadingsForm() {
  const { doc, apply } = useEditor();
  const started = doc.rollout.stages.filter((s) => s.status !== "not-started");
  const current = started.find((s) => s.status === "live" || s.status === "halted") ?? started.at(-1);
  const [picked, setStage] = useState<RolloutPercent | undefined>(undefined);
  // Default to the current stage, so the form follows the rollout as stages start.
  const stage = picked !== undefined && started.some((s) => s.cumulative === picked) ? picked : current?.cumulative;
  const [values, setValues] = useState<Record<string, string>>({});
  const [csv, setCsv] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const id = useId();
  if (!doc.alignment.metrics.length) return null;
  if (!started.length || stage === undefined) {
    return <p className="mb-4 text-sm text-muted-foreground">Start the 10% stage to record metric readings.</p>;
  }
  const NUM = /^-?\d+(\.\d+)?$/;
  const parsed = Object.fromEntries(
    Object.entries(values).filter(([, v]) => NUM.test(v.trim())).map(([k, v]) => [k, Number(v)]),
  );
  const invalid = Object.entries(values).filter(([, v]) => v.trim() !== "" && !NUM.test(v.trim())).map(([k]) => k);
  const closed = doc.rollout.stages.find((s) => s.cumulative === stage)?.status === "complete";
  return (
    <details className="mb-4 rounded-xl border border-border bg-background/30 p-4">
      <summary className="cursor-pointer text-sm font-semibold">Record readings</summary>
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!Object.keys(parsed).length) return;
          apply((d, now) => R.addReadings(d, stage, parsed, now));
          setValues({});
          setNote(`Saved ${Object.keys(parsed).length} reading(s) to the ${stage}% stage.`);
        }}
      >
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-stage`} className="text-sm">Stage</label>
          <select id={`${id}-stage`} value={stage} onChange={(e) => setStage(Number(e.target.value) as RolloutPercent)} className="h-8 rounded-lg border border-input bg-input/30 px-2 text-sm">
            {started.map((s) => <option key={s.cumulative} value={s.cumulative}>{s.cumulative}%</option>)}
          </select>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {doc.alignment.metrics.map((m) => (
            <div key={m.id} className="flex flex-col gap-1">
              <label htmlFor={`${id}-${m.id}`} className="text-xs font-semibold">{m.name}{m.unit && ` (${m.unit})`}</label>
              <Input
                id={`${id}-${m.id}`}
                inputMode="decimal"
                aria-invalid={invalid.includes(m.id)}
                value={values[m.id] ?? ""}
                onChange={(e) => setValues({ ...values, [m.id]: e.target.value })}
              />
              {invalid.includes(m.id) && <span className="text-xs text-destructive">Not a number — use a dot for decimals.</span>}
            </div>
          ))}
        </div>
        {closed && <p className="text-xs text-muted-foreground">This stage is closed — readings added now are kept for the record but don&apos;t change its gate.</p>}
        <Button type="submit" size="sm" className="self-start" disabled={!Object.keys(parsed).length || invalid.length > 0}>Save readings</Button>
      </form>
      <form
        className="mt-4 flex flex-col gap-2 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          let summary = "";
          apply((d, now) => {
            const res = R.importReadingsCsv(d, csv, now);
            const shown = res.errors.slice(0, 5).join(" ");
            const more = res.errors.length > 5 ? ` …and ${res.errors.length - 5} more.` : "";
            summary = `Imported ${res.imported} reading(s).${res.duplicates ? ` ${res.duplicates} duplicate(s) skipped.` : ""}${res.errors.length ? ` Skipped: ${shown}${more}` : ""}`;
            return res.doc;
          });
          setNote(summary);
          setCsv("");
        }}
      >
        <label htmlFor={`${id}-csv`} className="text-xs font-semibold">
          Import CSV — stage,metric,value[,recorded_at] · metric = id or name (case-insensitive) · decimals with a dot · ISO dates
        </label>
        <Textarea id={`${id}-csv`} rows={3} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"stage,metric,value\n30,Support tickets per 1k workspaces,9.4"} />
        <Button type="submit" size="sm" variant="outline" className="self-start" disabled={!csv.trim()}>Import</Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground empty:hidden" aria-live="polite">{note ?? ""}</p>
    </details>
  );
}

// ---------------------------------------------------------------- export & share

export function SharePanel() {
  const { doc, apply } = useEditor();
  const [step, setStep] = useState<"idle" | "confirm" | "confirm-delete" | "busy">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const share = doc.meta.share;
  const url = share && typeof window !== "undefined" ? `${window.location.origin}/share/${share.id}` : null;
  const emails = step === "confirm" ? emailsInSnapshot(doc) : [];

  useEffect(() => {
    if (step === "confirm" || step === "confirm-delete") confirmRef.current?.focus();
  }, [step]);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(toExportFile(doc, new Date()), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = exportFileName(doc);
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const create = async () => {
    setStep("busy");
    setMessage(null);
    try {
      const r = await fetch("/api/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(doc) });
      const json = (await r.json()) as { status: string; id?: string; deleteToken?: string; message?: string };
      if (json.status === "ok" && json.id && json.deleteToken) {
        const info = { id: json.id, deleteToken: json.deleteToken, createdAt: new Date().toISOString() };
        apply((d, now) => setShareInfo(d, info, now));
      } else setMessage(json.message ?? "Sharing failed — try again.");
    } catch {
      setMessage("Couldn't reach the server — try again.");
    }
    setStep("idle");
  };

  const remove = async () => {
    if (!share) return;
    setStep("busy");
    try {
      const r = await fetch(`/api/share?id=${encodeURIComponent(share.id)}`, { method: "DELETE", headers: { "x-delete-token": share.deleteToken } });
      const json = (await r.json().catch(() => ({ status: "error" }))) as { status: string; message?: string };
      if (json.status === "ok" || r.status === 404) {
        // Deleted now, or already gone (expired or removed elsewhere).
        apply((d, now) => setShareInfo(d, null, now));
        setMessage(r.status === 404 ? "That link had already expired or been deleted." : "Share link deleted. Anyone who opens it now sees “not found”.");
      } else setMessage(json.message ?? "Couldn't delete the link — try again.");
    } catch {
      setMessage("Couldn't reach the server — try again.");
    }
    setStep("idle");
    openRef.current?.focus();
  };

  return (
    <section aria-label="Export and share" className="surface flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={exportJson}>Export JSON</Button>
        {!share && step !== "confirm" && (
          <Button ref={openRef} size="sm" disabled={step === "busy"} onClick={() => setStep("confirm")}>Create read-only share link</Button>
        )}
        <span className="text-xs text-muted-foreground">This launch lives only in this browser — export it to keep a copy.</span>
      </div>
      {step === "confirm" && (
        <div
          role="alertdialog"
          aria-labelledby="share-warning"
          className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
          onKeyDown={(e) => e.key === "Escape" && setStep("idle")}
        >
          <p id="share-warning">
            <span className="font-semibold text-warning">Anyone with the link can view this launch.</span> The snapshot is
            uploaded to this deployment&apos;s storage. Recipient emails, sign-off names, owners and notes are removed; the brief,
            analysis, assets and decisions are published as written. Links expire after {SHARE_TTL_DAYS} days.
          </p>
          {emails.length > 0 && (
            <p className="font-medium text-warning">
              Your free text still contains {emails.length} email address{emails.length === 1 ? "" : "es"} ({emails.slice(0, 3).join(", ")}
              {emails.length > 3 ? "…" : ""}). Edit them out first if they shouldn&apos;t be public.
            </p>
          )}
          <div className="flex gap-2">
            <Button ref={confirmRef} size="sm" onClick={create}>Create link</Button>
            <Button size="sm" variant="ghost" onClick={() => setStep("idle")}>Cancel</Button>
          </div>
        </div>
      )}
      {share && url && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            Read-only snapshot from {fmtDayYear(share.createdAt)}. Later edits aren&apos;t included — delete and re-create to update it.
            Only this browser can delete it: clearing site data loses that ability (the link still expires after {SHARE_TTL_DAYS} days).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-full break-all rounded bg-background/60 px-2 py-1 text-xs">{url}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
            {step === "confirm-delete" ? (
              <span role="alertdialog" aria-label="Confirm delete" className="flex flex-wrap items-center gap-2">
                <span className="text-xs">Delete link? Anyone using it will see “not found”.</span>
                <Button ref={confirmRef} size="sm" variant="destructive" onClick={remove}>Delete</Button>
                <Button size="sm" variant="ghost" onClick={() => setStep("idle")}>Keep</Button>
              </span>
            ) : (
              <Button ref={openRef} size="sm" variant="destructive" disabled={step === "busy"} onClick={() => setStep("confirm-delete")}>Delete link</Button>
            )}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground empty:hidden" aria-live="polite">{message ?? ""}</p>
    </section>
  );
}

// ---------------------------------------------------------------- analysis detail

export function AnalysisDetailEditors({ field }: { field: AnalysisKey }) {
  const { doc, apply } = useEditor();
  const f = doc.analysis.fields[field];
  const id = useId();
  const blank: Highlight = { value: "", label: "", visual: "stat" };
  const [facts, setFacts] = useState<Highlight[]>(() => [0, 1, 2].map((i) => f.highlights?.[i] ?? blank));
  const set = (i: number, patch: Partial<Highlight>) => setFacts((all) => all.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  return (
    <section aria-label="Edit this analysis" className="surface flex flex-col gap-5 rounded-3xl p-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Summary</h2>
        <AnalysisEditor field={field} label="summary" />
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          apply((d, now) => E.setAnalysisDetail(d, field, { highlights: facts }, now));
        }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Three key facts</h2>
        {facts.map((h, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[8rem_1fr_9rem_6rem]">
            <label className="sr-only" htmlFor={`${id}-v${i}`}>Fact {i + 1} value</label>
            <Input id={`${id}-v${i}`} value={h.value} maxLength={20} placeholder="Value" onChange={(e) => set(i, { value: e.target.value })} />
            <label className="sr-only" htmlFor={`${id}-l${i}`}>Fact {i + 1} label</label>
            <Input id={`${id}-l${i}`} value={h.label} maxLength={40} placeholder="What it measures" onChange={(e) => set(i, { label: e.target.value })} />
            <label className="sr-only" htmlFor={`${id}-s${i}`}>Fact {i + 1} visual</label>
            <select id={`${id}-s${i}`} value={h.visual ?? "stat"} onChange={(e) => set(i, { visual: e.target.value as Highlight["visual"] })} className="h-8 rounded-lg border border-input bg-input/30 px-2 text-sm">
              <option value="stat">Number</option>
              <option value="meter">Meter (0–100)</option>
              <option value="trend">Trend</option>
            </select>
            {h.visual === "meter" ? (
              <>
                <label className="sr-only" htmlFor={`${id}-m${i}`}>Fact {i + 1} level</label>
                <Input id={`${id}-m${i}`} inputMode="numeric" value={h.level ?? ""} placeholder="0–100" onChange={(e) => set(i, { level: Number(e.target.value) || 0 })} />
              </>
            ) : h.visual === "trend" ? (
              <>
                <label className="sr-only" htmlFor={`${id}-t${i}`}>Fact {i + 1} trend</label>
                <select id={`${id}-t${i}`} value={h.trend ?? "up"} onChange={(e) => set(i, { trend: e.target.value as Highlight["trend"] })} className="h-8 rounded-lg border border-input bg-input/30 px-2 text-sm">
                  <option value="up">Up</option>
                  <option value="flat">Flat</option>
                  <option value="down">Down</option>
                </select>
              </>
            ) : (
              <span />
            )}
          </div>
        ))}
        <Button type="submit" size="sm" className="self-start">Save facts</Button>
      </form>
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Evidence & open questions (one per line)</h2>
        <InlineText
          value={(f.points ?? []).join("\n")}
          label="evidence and open questions, one per line"
          onSave={(t) => apply((d, now) => E.setAnalysisDetail(d, field, { points: t.split("\n") }, now))}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- expected results

function ImpactFields({ legend, value, onSave }: { legend: string; value: Impact | null; onSave: (i: Impact | null) => void }) {
  const id = useId();
  const [f, setF] = useState({ amount: value ? String(value.amount) : "", currency: value?.currency ?? "USD", period: value?.period ?? "first 12 months", note: value?.note ?? "" });
  const valid = /^\d+(\.\d+)?$/.test(f.amount.trim());
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(f.amount.trim() === "" ? null : valid ? { amount: Number(f.amount), currency: f.currency, period: f.period, note: f.note } : value);
      }}
    >
      <fieldset className="grid gap-2 sm:grid-cols-[8rem_5rem_1fr]">
        <legend className="mb-1 text-xs font-semibold">{legend}</legend>
        <label className="sr-only" htmlFor={`${id}-a`}>{legend} amount</label>
        <Input id={`${id}-a`} inputMode="decimal" placeholder="Amount" value={f.amount} aria-invalid={f.amount !== "" && !valid} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <label className="sr-only" htmlFor={`${id}-c`}>{legend} currency</label>
        <Input id={`${id}-c`} maxLength={3} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} />
        <label className="sr-only" htmlFor={`${id}-p`}>{legend} period</label>
        <Input id={`${id}-p`} maxLength={40} value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} />
        <label className="sr-only" htmlFor={`${id}-n`}>{legend} basis</label>
        <Input id={`${id}-n`} className="sm:col-span-3" maxLength={140} placeholder="Basis of the estimate" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </fieldset>
      <Button type="submit" size="sm" variant="outline" className="self-start">Save {legend.toLowerCase()}</Button>
    </form>
  );
}

export function ExpectedEditors() {
  const { doc, apply } = useEditor();
  const e = doc.alignment.expected;
  return (
    <div className="surface flex flex-col gap-4 rounded-2xl p-5 lg:col-span-2">
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">How it should look for the user (one per line)</h3>
        <InlineText
          value={(e?.userExperience ?? []).join("\n")}
          label="expected user experience, one per line"
          onSave={(t) => apply((d, now) => E.setExpected(d, { userExperience: t.split("\n") }, now))}
        />
      </div>
      <ImpactFields legend="Revenue increase" value={e?.revenue ?? null} onSave={(i) => apply((d, now) => E.setExpected(d, { revenue: i }, now))} />
      <ImpactFields legend="Expenses increase" value={e?.expenses ?? null} onSave={(i) => apply((d, now) => E.setExpected(d, { expenses: i }, now))} />
    </div>
  );
}
