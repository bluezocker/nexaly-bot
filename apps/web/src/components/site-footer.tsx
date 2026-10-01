import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

const nexalyLinks: { href: string; label: string; external?: boolean }[] = [
  { href: "/server", label: "Server" },
  { href: "/hilfe", label: "Hilfe" },
  { href: "/docs", label: "Docs" },
  { href: "https://status.nexaly.app/status/nexaly", label: "Status", external: true },
];

const legalLinks = [
  { href: "/agb", label: "AGB" },
  { href: "/datenschutz", label: "Datenschutzerklärung" },
  { href: "/nutzungsbedingungen", label: "Nutzungsbedingungen" },
  { href: "/impressum", label: "Impressum" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-nx-border bg-nx-elevated/80">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-10 sm:grid-cols-[1.2fr_1fr_1fr]">
        <div className="flex gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full ring-1 ring-nx-accent/40">
            <Image src="/logo.png" alt="" fill className="object-cover" sizes="40px" />
          </div>
          <div>
            <p className="text-sm font-semibold">Nexaly</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-nx-muted">
              Dein Server. Deine Regeln. Alles im Blick.
            </p>
          </div>
        </div>
        <nav aria-label="Nexaly">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-nx-accent-soft">Nexaly</p>
          <ul className="mt-3 grid gap-2">
            {nexalyLinks.map((link) => (
              <li key={link.href}>
                {link.external ? (
                  <a
                    href={link.href}
                    className="text-sm text-nx-muted transition hover:text-white"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link href={link.href} className="text-sm text-nx-muted transition hover:text-white">
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Rechtliches">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-nx-accent-soft">Rechtliches</p>
          <ul className="mt-3 grid gap-2">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-nx-muted transition hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-nx-border">
        <p className="mx-auto max-w-5xl px-6 py-4 text-xs text-nx-muted">
          © {new Date().getFullYear()} Nexaly · More than a bot
        </p>
      </div>
    </footer>
  );
}

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
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
            <Link href="/server" className="text-sm text-nx-muted hover:text-white">
              Server
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
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-8 grid gap-6 text-sm leading-relaxed text-nx-muted">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
