import type { SectionId } from "@/lib/launch-status";
import { cn } from "@/lib/utils";

export function Section({
  id,
  title,
  kicker,
  children,
  className,
}: {
  id: SectionId;
  title: string;
  kicker?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("surface scroll-mt-6 rounded-3xl p-5 sm:p-7", className)}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-title`} className="text-chrome text-2xl font-extrabold tracking-tight">{title}</h2>
        {kicker && <p className="text-sm text-muted-foreground">{kicker}</p>}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{children}</p>
  );
}

const PILL = {
  good: "bg-success/15 text-success",
  warn: "bg-warning/15 text-warning",
  bad: "bg-destructive/15 text-destructive",
  info: "bg-primary/15 text-primary",
  muted: "bg-muted text-muted-foreground",
} as const;

export function Pill({ tone, children }: { tone: keyof typeof PILL; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold", PILL[tone])}>
      {children}
    </span>
  );
}
