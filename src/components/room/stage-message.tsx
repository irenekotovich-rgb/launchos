"use client";

import { useState } from "react";
import { Copy, Mail } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { mailtoUrl, type StageMessage as Message } from "@/lib/notify";
import { cn } from "@/lib/utils";

/** Preview of the stage-complete message with "open in email" and copy. Sending stays with the PMM. */
export function StageMessage({ message, label }: { message: Message; label: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`To: ${message.to.join(", ")}\nSubject: ${message.subject}\n\n${message.body}`);
      setCopied(true);
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
            <a href={mailtoUrl(message)} className={cn(buttonVariants({ size: "sm" }), "h-8")}>
              <Mail /> Open in email
            </a>
            <button type="button" onClick={copy} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}>
              <Copy /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
