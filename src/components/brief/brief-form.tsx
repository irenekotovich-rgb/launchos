"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { runGeneration } from "@/lib/pipeline";
import { saveLaunch } from "@/lib/storage";
import type { LaunchBrief } from "@/lib/types";

export const LIMITS = { productName: 80, what: 400, who: 300, whyNow: 400, claim: 300, claims: 8 } as const;

type Fields = { productName: string; what: string; who: string; whyNow: string; targetDate: string; claims: string };
type Errors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = { productName: "", what: "", who: "", whyNow: "", targetDate: "", claims: "" };

function splitClaims(raw: string) {
  return raw.split("\n").map((c) => c.trim()).filter(Boolean);
}

export function validateBrief(f: Fields, today: Date): Errors {
  const e: Errors = {};
  const required = (k: keyof Fields, label: string) => {
    if (!f[k].trim()) e[k] = `${label} is required.`;
  };
  required("productName", "Product name");
  required("what", "What ships");
  required("who", "Who it's for");
  required("whyNow", "Why now");
  if (f.productName.length > LIMITS.productName) e.productName = `Keep it under ${LIMITS.productName} characters.`;
  if (f.what.length > LIMITS.what) e.what = `Keep it under ${LIMITS.what} characters.`;
  if (f.who.length > LIMITS.who) e.who = `Keep it under ${LIMITS.who} characters.`;
  if (f.whyNow.length > LIMITS.whyNow) e.whyNow = `Keep it under ${LIMITS.whyNow} characters.`;
  if (!f.targetDate) e.targetDate = "Pick a launch day.";
  else if (Date.parse(f.targetDate) <= today.getTime()) e.targetDate = "Launch day must be in the future.";
  const claims = splitClaims(f.claims);
  if (!claims.length) e.claims = "Add at least one claim, one per line.";
  else if (claims.length > LIMITS.claims) e.claims = `Up to ${LIMITS.claims} claims.`;
  else if (claims.some((c) => c.length > LIMITS.claim)) e.claims = `Each claim under ${LIMITS.claim} characters.`;
  return e;
}

export function BriefForm() {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "building" | "error">("idle");

  const set = (k: keyof Fields) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: ev.target.value }));

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const found = validateBrief(fields, new Date());
    setErrors(found);
    if (Object.keys(found).length) return;
    setStatus("building");
    try {
      const brief: LaunchBrief = {
        productName: fields.productName.trim(),
        what: fields.what.trim(),
        who: fields.who.trim(),
        whyNow: fields.whyNow.trim(),
        // Launch day at 09:00 local time.
        targetDate: new Date(`${fields.targetDate}T09:00:00`).toISOString(),
        claims: splitClaims(fields.claims),
      };
      const doc = await runGeneration(brief);
      if (!saveLaunch(doc)) throw new Error("storage");
      router.push(`/launch/${doc.meta.id}`);
    } catch {
      setStatus("error");
    }
  }

  const field = (k: keyof Fields, label: string, hint: string, input: React.ReactNode) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={k} className="text-sm font-semibold">{label}</Label>
      {input}
      <p id={`${k}-hint`} className={errors[k] ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
        {errors[k] ?? hint}
      </p>
    </div>
  );
  const aria = (k: keyof Fields) => ({ id: k, "aria-invalid": !!errors[k], "aria-describedby": `${k}-hint` });

  return (
    <form onSubmit={onSubmit} noValidate className="surface flex flex-col gap-6 rounded-2xl p-5 sm:p-8">
      {field("productName", "Product or feature name", `Up to ${LIMITS.productName} characters.`,
        <Input {...aria("productName")} value={fields.productName} onChange={set("productName")} maxLength={LIMITS.productName + 20} placeholder="e.g. Approval Workflows" />)}
      {field("what", "What ships", "One or two sentences a customer would understand.",
        <Textarea {...aria("what")} value={fields.what} onChange={set("what")} rows={3} />)}
      {field("who", "Who it's for", "The buyer or user who feels the problem most.",
        <Textarea {...aria("who")} value={fields.who} onChange={set("who")} rows={2} />)}
      {field("whyNow", "Why now", "The trigger: churn reason, deal blocker, market shift, deadline.",
        <Textarea {...aria("whyNow")} value={fields.whyNow} onChange={set("whyNow")} rows={2} />)}
      {field("targetDate", "Launch day (100% rollout)", "The countdown and every phase ETA are planned back from this date.",
        <Input {...aria("targetDate")} type="date" value={fields.targetDate} onChange={set("targetDate")} className="w-full sm:w-56" />)}
      {field("claims", "Key claims", `One per line, up to ${LIMITS.claims}. Every asset is checked against these.`,
        <Textarea {...aria("claims")} value={fields.claims} onChange={set("claims")} rows={4} placeholder={"Approve a release in one click\nIncluded in the Business plan"} />)}

      {status === "error" && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t save the launch in this browser. Storage may be blocked (private window?). Try again or open the demo.
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
