"use client";

import { useRef, useState } from "react";
import { Copy, Mail } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { MAILTO_MAX_LENGTH, mailtoUrl, type StageMessage as Message } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { markNotified } from "@/lib/rollout-edit";
import { track } from "@/lib/analytics";
import type { RolloutPercent } from "@/lib/types";
import { useOptionalEditor } from "./editors";

/** Preview of the stage-complete message with "open in email" and copy. Sending stays with the PMM. */
export function StageMessage({ message, label, stage }: { message: Message; label: string; stage: RolloutPercent }) {
  const editor = useOptionalEditor();
  // In an own launch, opening or copying the message records it as sent (the PMM's client sends it).
  const reported = useRef(false);
  // Only own launches count (the demo and shared views have no editor); once per stage per view.
  const sent = () => {
    if (!editor) return;
    if (!reported.current) {
      reported.current = true;
      track("stage_notification_opened", { stage });
    }
    editor.apply((d, now) => markNotified(d, stage, now));
  };
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`To: ${message.to.join(", ")}\nSubject: ${message.subject}\n\n${message.body}`);
      setCopied(true);
      sent();
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="self-start text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        {open ? "Hide message" : label}
      </button>
      {open && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
          <p className="break-words text-muted-foreground">
            <span className="font-semibold text-foreground">To:</span> {message.to.length ? message.to.join(", ") : "No recipients yet"}
          </p>
          <p className="break-words"><span className="font-semibold">Subject:</span> {message.subject}</p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-muted-foreground">{message.body}</pre>
          <div className="flex flex-wrap gap-2">
            {message.to.length > 0 && mailtoUrl(message).length <= MAILTO_MAX_LENGTH ? (
              <a href={mailtoUrl(message)} onClick={sent} className={cn(buttonVariants({ size: "sm" }), "h-8")}>
                <Mail /> Open in email
              </a>
            ) : (
              <span className="self-center text-xs text-muted-foreground">
                {message.to.length ? "Too long for an email link — use Copy." : "Add recipients to open it in email."}
              </span>
            )}
            <button type="button" onClick={copy} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}>
              <Copy /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
