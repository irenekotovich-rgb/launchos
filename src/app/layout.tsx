import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AUTHOR, AuthorCredit } from "@/components/author-credit";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
        className="flex min-h-dvh flex-col antialiased"
      >
        {children}
        <AuthorCredit />
      </body>
    </html>
  );
}
