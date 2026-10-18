// POST /api/share — store a redacted, read-only snapshot under an unguessable id.
// DELETE /api/share?id=… with header x-delete-token — remove it.
import { NextResponse } from "next/server";
import { SHARE_ID } from "@/lib/share";
import { createShare, deleteShare } from "@/lib/share-store";
import { isLaunchDoc } from "@/lib/validate";

export const runtime = "nodejs";

const MAX_BYTES = 400_000;
const PER_HOUR = 10;
const recent = new Map<string, number[]>();

function client(req: Request) {
  const h = req.headers;
  return h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
}

export async function POST(req: Request) {
  const who = client(req);
  const now = Date.now();
  const mine = (recent.get(who) ?? []).filter((t) => now - t < 3_600_000);
  if (mine.length >= PER_HOUR) return NextResponse.json({ status: "invalid", message: "Too many share links this hour — try later." }, { status: 429 });
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BYTES) return NextResponse.json({ status: "invalid", message: "This launch is too large to share." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ status: "invalid", message: "Body must be JSON." }, { status: 400 });
  }
  if (!isLaunchDoc(body) || body.meta.mode !== "own") {
    return NextResponse.json({ status: "invalid", message: "Only your own launches can be shared." }, { status: 400 });
  }
  try {
    const { id, deleteToken } = await createShare(body);
    recent.set(who, [...mine, now]);
    return NextResponse.json({ status: "ok", id, deleteToken });
  } catch (err) {
    console.error("[share] store failed", err);
    return NextResponse.json({ status: "unavailable", message: "Sharing is unavailable right now — try again later." });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const token = req.headers.get("x-delete-token") ?? "";
  if (!SHARE_ID.test(id) || !token) return NextResponse.json({ status: "invalid", message: "Missing id or token." }, { status: 400 });
  try {
    const ok = await deleteShare(id, token);
    return ok
      ? NextResponse.json({ status: "ok" })
      : NextResponse.json({ status: "invalid", message: "Link not found or token doesn't match." }, { status: 404 });
  } catch (err) {
    console.error("[share] delete failed", err);
    return NextResponse.json({ status: "unavailable", message: "Couldn't delete the link right now — try again." });
  }
}
