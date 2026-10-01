import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <div className="rounded-2xl border border-nx-border bg-nx-card/90 p-8 shadow-glow backdrop-blur">
          <div className="mb-6 flex justify-center">
            <div className="relative h-28 w-28 overflow-hidden rounded-full shadow-glow-sm ring-2 ring-nx-accent/50">
              <Image src="/logo.png" alt="Nexaly" fill className="object-cover" priority sizes="112px" />
            </div>
          </div>
          <p className="text-center text-sm uppercase tracking-[0.25em] text-nx-accent-soft">Nexaly</p>
          <h1 className="mt-2 text-center text-2xl font-semibold">Anmelden</h1>
          <p className="mt-2 text-center text-sm text-nx-muted">
            Nur Server mit Owner-, Admin- oder Manage-Server-Rechten erscheinen im Dashboard.
          </p>
          <a
            href="/api/auth/discord"
            className="mt-8 flex min-h-11 items-center justify-center rounded-xl bg-nx-accent px-4 text-sm font-semibold text-white shadow-glow-sm transition hover:bg-nx-accent-soft"
          >
            Weiter mit Discord
          </a>
          <p className="mt-4 text-center text-[11px] uppercase tracking-[0.2em] text-nx-muted">
            Dein Server. Deine Regeln. Alles im Blick.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
