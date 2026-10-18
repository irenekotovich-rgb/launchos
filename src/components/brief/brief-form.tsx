"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { runGeneration } from "@/lib/pipeline";
import { saveLaunch } from "@/lib/storage";
import { EMPTY_FIELDS, LIMITS, MAX_YEARS_AHEAD, launchMoment, localDate, splitClaims, validateBrief } from "@/lib/brief";
import type { Errors, Fields } from "@/lib/brief";
import type { LaunchBrief } from "@/lib/types";

const ORDER: (keyof Fields)[] = ["productName", "what", "who", "whyNow", "targetDate", "claims"];

export function BriefForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "building" | "storage-error" | "generation-error">("idle");

  const set = (k: keyof Fields) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = ev.target.value;
    setFields((f) => ({ ...f, [k]: value }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const now = new Date();
    const found = validateBrief(fields, now);
    setErrors(found);
    const firstInvalid = ORDER.find((k) => found[k]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`#${firstInvalid}`)?.focus();
      return;
    }
    setStatus("building");
    let doc;
    try {
      const brief: LaunchBrief = {
        productName: fields.productName.trim(),
        what: fields.what.trim(),
        who: fields.who.trim(),
        whyNow: fields.whyNow.trim(),
        targetDate: launchMoment(fields.targetDate)!.toISOString(),
        claims: splitClaims(fields.claims),
      };
      doc = await runGeneration(brief, now);
    } catch {
      setStatus("generation-error");
      return;
    }
    if (!saveLaunch(doc)) {
      setStatus("storage-error");
      return;
    }
    router.push(`/launch/${doc.meta.id}`);
  }

  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const latest = new Date(today.getFullYear() + MAX_YEARS_AHEAD, today.getMonth(), today.getDate());

  const aria = (k: keyof Fields) => ({
    id: k,
    "aria-required": true,
    "aria-invalid": !!errors[k],
    "aria-describedby": `${k}-hint ${k}-error`,
  });
  const field = (k: keyof Fields, label: string, hint: string, input: React.ReactNode) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={k} className="text-sm font-semibold">
        {label} <span className="font-normal text-muted-foreground">(required)</span>
      </Label>
      {input}
      <p id={`${k}-hint`} className="text-sm text-muted-foreground">{hint}</p>
      <p id={`${k}-error`} aria-live="polite" className="text-sm font-medium text-destructive empty:hidden">
        {errors[k] ?? ""}
      </p>
    </div>
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="surface flex flex-col gap-6 rounded-2xl p-5 sm:p-8">
      {field("productName", "Product or feature name", `Up to ${LIMITS.productName} characters.`,
        <Input {...aria("productName")} value={fields.productName} onChange={set("productName")} placeholder="e.g. Approval Workflows" />)}
      {field("what", "What ships", "One or two sentences a customer would understand.",
        <Textarea {...aria("what")} value={fields.what} onChange={set("what")} rows={3} />)}
      {field("who", "Who it's for", "The buyer or user who feels the problem most.",
        <Textarea {...aria("who")} value={fields.who} onChange={set("who")} rows={2} />)}
      {field("whyNow", "Why now", "The trigger: churn reason, deal blocker, market shift, deadline.",
        <Textarea {...aria("whyNow")} value={fields.whyNow} onChange={set("whyNow")} rows={2} />)}
      {field("targetDate", "Launch day (100% rollout)", "The countdown and every phase ETA are planned back from this date.",
        <Input {...aria("targetDate")} type="date" min={localDate(tomorrow)} max={localDate(latest)} value={fields.targetDate} onChange={set("targetDate")} className="w-full sm:w-56" />)}
      {field("claims", "Key claims", `One per line, up to ${LIMITS.claims}. Every asset is checked against these.`,
        <Textarea {...aria("claims")} value={fields.claims} onChange={set("claims")} rows={4} placeholder={"Approve a release in one click\nIncluded in the Business plan"} />)}

      {(status === "storage-error" || status === "generation-error") && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {status === "storage-error"
            ? "Couldn't save the launch in this browser. Storage may be blocked (private window?). Try again or open the demo."
            : "Couldn't build the plan from this brief. Check the launch day and try again."}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" className="h-11 px-5 text-base" disabled={status === "building"}>
          {status === "building" ? (<><Loader2 className="animate-spin" /> Building your launch room…</>) : "Build the launch room"}
        </Button>
        <span className="text-sm text-muted-foreground">Nothing is sent anywhere in this step.</span>
      </div>
    </form>
  );
}
