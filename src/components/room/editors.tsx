"use client";

// Inline editors for own launches. Each one applies a pure edit from lib/edit.ts through the
// LaunchEditor context; the owner component persists the result. The demo never renders these.

import { createContext, useContext, useId, useState } from "react";
import { Check, Circle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import * as E from "@/lib/edit";
import type { AnalysisKey, LaunchDoc, Metric, PhaseKey, Recipient, TeamKey, TeamSignoff } from "@/lib/types";
import { cn } from "@/lib/utils";

type Apply = (edit: (doc: LaunchDoc, now: Date) => LaunchDoc) => void;
const Ctx = createContext<{ doc: LaunchDoc; apply: Apply } | null>(null);

export function LaunchEditor({ doc, onChange, children }: { doc: LaunchDoc; onChange: (d: LaunchDoc) => void; children: React.ReactNode }) {
  const apply: Apply = (edit) => onChange(edit(doc, new Date()));
  return <Ctx.Provider value={{ doc, apply }}>{children}</Ctx.Provider>;
}

function useEditor() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Editor components must be inside <LaunchEditor>");
  return ctx;
}

const iconBtn = "grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground";

/** Click-to-edit text with explicit Save / Cancel. */
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
  const id = useId();
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="group inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        aria-label={`Edit ${label}`}
      >
        <Pencil className="size-3.5" aria-hidden /> {value ? "Edit" : "Add"}
      </button>
    );
  }
  const Field = multiline ? Textarea : Input;
  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Field
        id={id}
        value={draft}
        autoFocus
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setDraft(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent) => e.key === "Escape" && setEditing(false)}
        {...(multiline ? { rows: 3 } : {})}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            onSave(draft.trim());
            setEditing(false);
          }}
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>
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
      {done ? <Check className="size-4 text-success" /> : <Circle className="size-4" />}
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
      <Trash2 className="size-4" />
    </button>
  );
}

export function MetricForm({ kind }: { kind: Metric["kind"] }) {
  const { doc, apply } = useEditor();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", unit: "", direction: "above" as Metric["direction"], threshold: "", owner: "" });
  const id = useId();
  if (doc.alignment.lockedAt) return null;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
        <Plus className="size-3.5" aria-hidden /> Add {kind} metric
      </button>
    );
  }
  const threshold = Number(f.threshold);
  const valid = f.name.trim() && f.owner.trim() && f.threshold !== "" && Number.isFinite(threshold);
  return (
    <form
      className="mt-3 grid gap-2 rounded-lg border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        apply((d, now) => E.upsertMetric(d, { kind, name: f.name.trim(), unit: f.unit.trim(), direction: f.direction, threshold, owner: f.owner.trim() }, now));
        setF({ name: "", unit: "", direction: "above", threshold: "", owner: "" });
        setOpen(false);
      }}
    >
      <label className="text-xs font-semibold" htmlFor={`${id}-name`}>Metric name</label>
      <Input id={`${id}-name`} value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={kind === "success" ? "Workspaces using the feature" : "Support tickets per 1k workspaces"} />
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
        <Button type="submit" size="sm" disabled={!valid}>Add metric</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
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
        <Input id={`${id}-lead`} defaultValue={s.lead} placeholder="Lead name" maxLength={80} onBlur={(e) => e.target.value !== s.lead && set({ lead: e.target.value.trim() })} />
        <label htmlFor={`${id}-status`} className="sr-only">{label} status</label>
        <select id={`${id}-status`} value={s.status} onChange={(e) => set({ status: e.target.value as TeamSignoff["status"] })} className="h-8 rounded-lg border border-input bg-input/30 px-2 text-sm">
          <option value="pending">pending</option>
          <option value="signed">signed</option>
          <option value="objected">objected</option>
        </select>
      </div>
      <label htmlFor={`${id}-note`} className="sr-only">{label} note</label>
      <Input id={`${id}-note`} defaultValue={s.note} placeholder="Note (optional)" maxLength={200} onBlur={(e) => e.target.value !== s.note && set({ note: e.target.value.trim() })} />
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
  return <InlineText value={text} label="decision" multiline={false} maxLength={300} onSave={(t) => t && apply((d, now) => E.editDecision(d, id, t, now))} />;
}

export function RecipientForm() {
  const { apply } = useEditor();
  const [r, setR] = useState<Recipient>({ name: "", role: "", email: "", group: "team-lead" });
  const id = useId();
  const valid = r.name.trim() && E.isEmail(r.email.trim());
  return (
    <form
      className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1.3fr_auto_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        apply((d, now) => E.addRecipient(d, { ...r, name: r.name.trim(), role: r.role.trim(), email: r.email.trim() }, now));
        setR({ name: "", role: "", email: "", group: r.group });
      }}
    >
      <label className="sr-only" htmlFor={`${id}-n`}>Name</label>
      <Input id={`${id}-n`} value={r.name} placeholder="Name" maxLength={80} onChange={(e) => setR({ ...r, name: e.target.value })} />
      <label className="sr-only" htmlFor={`${id}-r`}>Role</label>
      <Input id={`${id}-r`} value={r.role} placeholder="Role" maxLength={80} onChange={(e) => setR({ ...r, role: e.target.value })} />
      <label className="sr-only" htmlFor={`${id}-e`}>Email</label>
      <Input id={`${id}-e`} type="email" value={r.email} placeholder="Email" maxLength={120} onChange={(e) => setR({ ...r, email: e.target.value })} />
      <label className="sr-only" htmlFor={`${id}-g`}>Group</label>
      <select id={`${id}-g`} value={r.group} onChange={(e) => setR({ ...r, group: e.target.value as Recipient["group"] })} className="h-8 rounded-lg border border-input bg-input/30 px-2 text-sm">
        <option value="team-lead">Team lead</option>
        <option value="stakeholder">Stakeholder</option>
      </select>
      <Button type="submit" size="sm" className="h-8" disabled={!valid}>Add</Button>
    </form>
  );
}

export function RecipientRemove({ email, name }: { email: string; name: string }) {
  const { apply } = useEditor();
  return (
    <button type="button" className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={`Remove ${name}`} onClick={() => apply((d, now) => E.removeRecipient(d, email, now))}>
      <Trash2 className="size-3.5" />
    </button>
  );
}
