// Best-effort client identity for per-client limits. On Vercel the platform sets
// x-vercel-forwarded-for; behind any other proxy these headers are only trustworthy if the
// proxy overwrites them (see README "Self-hosting").
export function clientKey(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}
