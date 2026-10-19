import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5">
      <Logo />
      <nav className="flex items-center gap-4 text-sm text-muted-foreground">
        <Link href="/demo" className="hover:text-foreground">Demo</Link>
        <Link href="/new" className="hover:text-foreground">New launch</Link>
        <Link href="/how" className="hover:text-foreground max-sm:hidden">How I built this</Link>
        <a href="https://github.com/iryna-kotovych/launchos" className="hover:text-foreground" target="_blank" rel="noopener">
          GitHub
        </a>
      </nav>
    </header>
  );
}
