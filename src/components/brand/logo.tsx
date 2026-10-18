import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="text-lg font-extrabold tracking-tight text-foreground" aria-label="LaunchOS home">
      Launch<span className="text-primary">OS</span>
    </Link>
  );
}
