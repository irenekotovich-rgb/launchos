import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AUTHOR, AuthorCredit } from "@/components/author-credit";
import { AnalyticsInit } from "@/components/analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Absolute URLs for OG images: production URL on Vercel, localhost otherwise.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "LaunchOS — your launch, in one URL",
  description:
    "Open-source launch room: analysis, alignment, plan, staged rollout, metrics and the full asset kit in one place.",
  authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} font-sans`}>
      <body
        className="bg-metal flex min-h-dvh flex-col antialiased"
      >
        <AnalyticsInit />
        {children}
        <AuthorCredit />
      </body>
    </html>
  );
}
