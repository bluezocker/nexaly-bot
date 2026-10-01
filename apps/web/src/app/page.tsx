import Image from "next/image";
import Link from "next/link";
import { ServerGrid } from "@/components/server-grid";
import { SiteFooter } from "@/components/site-footer";
import { loadPublicServers } from "@/lib/public-servers";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { count, servers } = await loadPublicServers();
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
              <Link
                href="/server"
                className="inline-flex min-h-11 items-center rounded-xl border border-nx-border px-4 text-sm font-semibold text-nx-muted hover:border-nx-accent/50 hover:text-white"
              >
                {count > 0 ? `${count} Server` : "Server"}
              </Link>
            </div>
          </div>
        </div>
        <section className="mt-16">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="text-lg font-semibold">Installiert auf</h2>
            <Link href="/server" className="text-sm text-nx-accent-soft hover:text-white">
              Alle anzeigen
            </Link>
          </div>
          <ServerGrid servers={servers.slice(0, 6)} />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
