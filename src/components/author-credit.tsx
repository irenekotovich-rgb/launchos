// Author attribution is a hard requirement (CLAUDE.md): every page renders this footer.
export const AUTHOR = {
  name: "Iryna Kotovych",
  url: "https://www.linkedin.com/in/irynakotovych/",
} as const;

export function AuthorCredit() {
  return (
    <footer className="mt-auto border-t border-white/10 px-4 py-6 text-center text-sm text-zinc-300">
      Made by{" "}
      <a
        href={AUTHOR.url}
        target="_blank"
        rel="author noopener"
        className="font-semibold text-zinc-100 underline-offset-4 hover:underline"
      >
        {AUTHOR.name}
      </a>
    </footer>
  );
}
