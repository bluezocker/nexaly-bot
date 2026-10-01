import Image from "next/image";
import Link from "next/link";
import { ServerGrid } from "@/components/server-grid";
import { SiteFooter } from "@/components/site-footer";
import { loadPublicServers } from "@/lib/public-servers";

export const dynamic = "force-dynamic";

export default async function ServersPage() {
  const { count, servers, error } = await loadPublicServers();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-nx-border/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-full">
              <Image src="/logo.png" alt="" fill className="object-cover" sizes="36px" />
            </div>
            <span className="text-sm font-semibold tracking-wide">Nexaly</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/server" className="text-sm text-white">
              Server
            </Link>
            <Link href="/docs" className="text-sm text-nx-muted hover:text-white">
              Docs
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-lg bg-nx-accent px-4 text-sm font-semibold text-white"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-nx-accent-soft">Übersicht</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Server mit Nexaly</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-nx-muted">
          {error
            ? `Die Liste konnte nicht geladen werden (${error}).`
            : count === 0
              ? "Nexaly ist gerade auf keinem Server. Der Bot schreibt die Server beim Start. Danach diese Seite neu laden."
              : `Nexaly ist auf ${count} ${count === 1 ? "Server" : "Servern"} installiert. Angezeigt werden Name, Icon und Mitgliederzahl — keine internen IDs.`}
        </p>
        <div className="mt-8">
          <ServerGrid servers={servers} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
