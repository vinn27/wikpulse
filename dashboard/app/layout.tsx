import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WikiPulse — live Wikipedia edit analytics",
  description:
    "Live dashboard of Wikipedia edits: volumes, human vs bot activity, and hottest pages. Pipeline: GitHub Actions → Redpanda (Kafka) → PySpark → Neon.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
