// Open Graph card shared by the landing, demo and share routes (rendered by next/og).
// Always carries the author byline (CLAUDE.md attribution rule).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { AUTHOR } from "@/lib/author";

export const OG_SIZE = { width: 1200, height: 630 };

const chrome = "linear-gradient(180deg, #ffffff 0%, #d9d9de 32%, #8b8b94 54%, #e9e9ee 72%, #a9a9b2 100%)";

const fontDir = path.join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: "normal" }[]> | null = null;
/** Geist from the npm package (bundled with the function) — no network needed to render. */
function loadFonts() {
  fonts ??= Promise.all([
    readFile(path.join(fontDir, "Geist-Regular.ttf")).then((data) => ({ name: "Geist", data, weight: 400 as const, style: "normal" as const })),
    readFile(path.join(fontDir, "Geist-Bold.ttf")).then((data) => ({ name: "Geist", data, weight: 700 as const, style: "normal" as const })),
  ]);
  return fonts;
}

export async function ogCard({ kicker, title, stats = [] }: { kicker: string; title: string; stats?: { value: string; label: string }[] }) {
  const fontData = await loadFonts().catch(() => undefined);
  const size = title.length > 34 ? 64 : title.length > 22 ? 80 : 96;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          color: "#f2f2f4",
          background:
            "radial-gradient(90% 70% at 100% 100%, rgba(122,44,60,0.85) 0%, rgba(10,10,12,0) 60%), linear-gradient(160deg, #141416 0%, #0a0a0c 60%, #1e0a10 100%)",
          fontFamily: fontData ? "Geist" : "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
            Launch<span style={{ color: "#e8a9b7" }}>OS</span>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#d4d4da", textTransform: "uppercase", letterSpacing: 4 }}>{kicker}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontSize: size,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              backgroundImage: chrome,
              backgroundClip: "text",
              color: "transparent",
              maxWidth: 1072,
            }}
          >
            {title}
          </div>
          {stats.length > 0 && (
            <div style={{ display: "flex", gap: 20 }}>
              {stats.slice(0, 3).map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "18px 26px",
                    borderRadius: 24,
                    border: "1px solid rgba(255,200,210,0.25)",
                    background: "linear-gradient(160deg, #7a2c3c 0%, #4a1724 60%, #2c0c14 100%)",
                  }}
                >
                  <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#ffffff" }}>{s.value}</div>
                  <div style={{ display: "flex", fontSize: 20, color: "#ffffff" }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#d4d4da" }}>
          <div style={{ display: "flex" }}>{title === "Your launch, in one URL." ? "Open source · bring your own key" : "Your launch, in one URL."}</div>
          <div style={{ display: "flex" }}>
            Made by&nbsp;<span style={{ color: "#ffffff", fontWeight: 700 }}>{AUTHOR.name}</span>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, ...(fontData ? { fonts: fontData } : {}) },
  );
}
