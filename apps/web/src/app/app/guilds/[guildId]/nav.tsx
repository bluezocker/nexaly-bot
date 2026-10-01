"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Me } from "@/lib/api";

const items = [
  { href: "", label: "Übersicht" },
  { href: "/streams", label: "Live-Alerts" },
  { href: "/moderation", label: "Moderation" },
  { href: "/welcome", label: "Willkommen" },
  { href: "/logs", label: "Logs" },
  { href: "/levels", label: "Level" },
  { href: "/embeds", label: "Embeds" },
  { href: "/tickets", label: "Tickets" },
  { href: "/social", label: "Social" },
  { href: "/settings", label: "Einstellungen" },
];

export function GuildNav({ guildId, me }: { guildId: string; me: Me }) {
  const pathname = usePathname();
  const base = `/app/guilds/${guildId}`;
  const display = me.globalName ?? me.username ?? "Discord";
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-nx-border bg-nx-elevated/95 md:min-h-screen md:w-60 md:border-b-0 md:border-r">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="relative h-9 w-9 overflow-hidden rounded-full ring-1 ring-nx-accent/40 shadow-glow-sm">
          <Image src="/logo.png" alt="Nexaly" fill className="object-cover" sizes="36px" />
        </div>
        <Link href="/app" className="text-sm font-semibold tracking-wide text-nx-accent-soft">
          Nexaly
        </Link>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-y-auto">
        {items.map((item) => {
          const href = `${base}${item.href}`;
          const active = item.href === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={item.href}
              href={href}
              className={`whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-nx-accent/25 text-white shadow-glow-sm"
                  : "text-nx-muted hover:bg-nx-accent/10 hover:text-nx-accent-soft"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-nx-border px-3 py-3">
        <div className="flex items-center gap-3">
          {me.avatarUrl ? (
            <img src={me.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-nx-accent/40" />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded-full bg-nx-card text-xs font-semibold">
              {display.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{display}</p>
            <p className="truncate text-xs text-nx-muted">@{me.username} · Discord</p>
          </div>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-nx-border text-sm font-medium text-nx-muted transition hover:border-nx-accent/50 hover:text-white"
          >
            Abmelden
          </button>
        </form>
      </div>
    </aside>
  );
}
