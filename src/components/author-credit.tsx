// Author attribution is a hard requirement (CLAUDE.md): every page renders this footer.
import { AUTHOR } from "@/lib/author";

export { AUTHOR };

export function AuthorCredit() {
  return (
    <footer className="mt-auto border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
      Made by{" "}
      <a
        href={AUTHOR.url}
        target="_blank"
        rel="author noopener"
        className="font-semibold text-foreground underline-offset-4 hover:underline"
      >
        {AUTHOR.name}
      </a>
    </footer>
  );
}
