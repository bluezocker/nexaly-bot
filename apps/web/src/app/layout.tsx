import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexaly",
  description: "Nexaly — Dein Server. Deine Regeln. Alles im Blick.",
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
