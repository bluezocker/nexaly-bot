import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";

type Feature = {
  title: string;
  text: string;
  /** Anker in den Docs */
  docs: string;
  icon: ReactNode;
};

const features: Feature[] = [
  {
    title: "Moderation",
    text: "Auto-Mod gegen Spam, Links, Einladungen und Caps. Eigene Regeln, Verwarnungen mit Eskalation und Raid-Schutz.",
    docs: "moderation",
    icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  },
  {
    title: "Live-Alerts",
    text: "Meldet, wenn Kanäle auf Twitch, YouTube oder Kick live gehen. Mit eigenem Text und Rollen-Erwähnung.",
    docs: "streams",
    icon: (
      <>
        <circle cx="12" cy="12" r="2" />
        <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" />
      </>
    ),
  },
  {
    title: "Willkommen",
    text: "Begrüßt neue Mitglieder als Text, Embed oder Bildkarte mit eigenem Hintergrund.",
    docs: "welcome",
    icon: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6M22 11h-6" />
      </>
    ),
  },
  {
    title: "Level",
    text: "XP pro Nachricht, Rangliste und Rollen als Belohnung für erreichte Level.",
    docs: "levels",
    icon: (
      <>
        <path d="M22 7l-8.5 8.5-5-5L2 17" />
        <path d="M16 7h6v6" />
      </>
    ),
  },
  {
    title: "Tickets",
    text: "Support per Button in privaten Kanälen. Beim Schließen landet das Protokoll im Log-Kanal.",
    docs: "tickets",
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  },
  {
    title: "Logs",
    text: "Hält fest, was passiert: gelöschte Nachrichten, Beitritte, Rollen, Bans und Voice.",
    docs: "logs",
    icon: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8" />
      </>
    ),
  },
  {
    title: "Embeds und Reaktionsrollen",
    text: "Embeds im Dashboard bauen und senden. Mitglieder holen sich Rollen per Reaktion.",
    docs: "embeds",
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </>
    ),
  },
  {
    title: "Social",
    text: "Neue Posts von X und Threads erscheinen automatisch in einem Kanal.",
    docs: "social",
    icon: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
      </>
    ),
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-nx-border/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-sm font-semibold tracking-wide">
            Nexaly
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/server" className="text-nx-muted hover:text-white">
              Server
            </Link>
            <Link href="/docs" className="text-nx-muted hover:text-white">
              Docs
            </Link>
            <Link href="/login" className="rounded-lg bg-nx-accent px-3 py-2 font-semibold text-white">
              Anmelden
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16">
        <div className="flex flex-col items-start gap-10 md:flex-row md:items-center">
          <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-full shadow-glow ring-2 ring-nx-accent/40 md:h-52 md:w-52">
            <Image src="/logo.png" alt="Nexaly" fill className="object-cover" priority sizes="208px" />
          </div>
          <div>
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-nx-accent-soft">Nexaly[BETA]</p>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Dein Server. Deine Regeln. Alles im Blick.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-nx-muted">
              Dashboard für Moderation, Live-Alerts, Willkommen, Level und Logs — getrennt pro
              Server. Simple. Smart. Reliable.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-xl bg-nx-accent px-5 text-sm font-semibold text-white shadow-glow transition hover:bg-nx-accent-soft"
              >
                Mit Discord anmelden
              </Link>
              <a
                href="#funktionen"
                className="inline-flex min-h-11 items-center rounded-xl border border-nx-border px-4 text-sm font-semibold text-nx-muted hover:border-nx-accent/50 hover:text-white"
              >
                Funktionen ansehen
              </a>
            </div>
          </div>
        </div>

        <section id="funktionen" className="mt-20 scroll-mt-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Was Nexaly kann</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-nx-muted">
                Jedes Modul schaltest du pro Server im Dashboard ein und stellst es dort ein.
              </p>
            </div>
            <Link href="/docs" className="text-sm text-nx-accent-soft hover:text-white">
              Zur Anleitung
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <li key={feature.docs}>
                <Link
                  href={`/docs#${feature.docs}`}
                  className="group flex h-full flex-col rounded-2xl border border-nx-border bg-nx-card p-5 transition hover:border-nx-accent/60 hover:shadow-glow-sm"
                >
                  <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-nx-accent/15 text-nx-accent-soft ring-1 ring-nx-accent/30">
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {feature.icon}
                    </svg>
                  </span>
                  <h3 className="font-semibold group-hover:text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-nx-muted">{feature.text}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
