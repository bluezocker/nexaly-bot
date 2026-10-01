import Image from "next/image";
import Link from "next/link";
import { apiFetch, type ManageableGuild, type Me } from "@/lib/api";

function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    owner: "Owner",
    administrator: "Administrator",
    manage_guild: "Manage Server",
    manager_role: "Manager",
  };
  return map[reason] ?? reason;
}

export default async function GuildPickerPage() {
  const [me, payload] = await Promise.all([
    apiFetch<Me>("/v1/me"),
    apiFetch<{ guilds: ManageableGuild[] }>("/v1/guilds"),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 overflow-hidden rounded-full shadow-glow-sm ring-1 ring-nx-accent/40">
            <Image src="/logo.png" alt="Nexaly" fill className="object-cover" sizes="48px" />
          </div>
          <div>
            <p className="text-sm text-nx-accent-soft">Nexaly</p>
            <h1 className="text-3xl font-semibold">Server auswählen</h1>
            <p className="mt-1 text-sm text-nx-muted">Angemeldet als {me.globalName ?? me.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-nx-border bg-nx-card px-3 py-2">
          {me.avatarUrl ? (
            <img src={me.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded-full bg-nx-elevated text-xs font-semibold">
              {(me.globalName ?? me.username).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{me.globalName ?? me.username}</p>
            <p className="truncate text-xs text-nx-muted">@{me.username} · Discord</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-lg border border-nx-border px-3 py-2 text-sm text-nx-muted hover:border-nx-accent/50">
              Abmelden
            </button>
          </form>
        </div>
      </header>
      {payload.guilds.length === 0 ? (
        <div className="rounded-2xl border border-nx-border bg-nx-card p-8 text-nx-muted">
          Keine verwaltbaren Server gefunden.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {payload.guilds.map((guild) => (
            <li
              key={guild.id}
              className="flex items-center gap-4 rounded-2xl border border-nx-border bg-nx-card p-4 transition hover:border-nx-accent/40 hover:shadow-glow-sm"
            >
              {guild.iconUrl ? (
                <img src={guild.iconUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-nx-elevated text-sm font-semibold text-nx-accent-soft">
                  {guild.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{guild.name}</p>
                <p className="text-xs text-nx-muted">
                  {reasonLabel(guild.accessReason)}
                  {guild.botInstalled ? " · Bot aktiv" : " · Bot fehlt"}
                </p>
              </div>
              {guild.botInstalled ? (
                <Link
                  href={`/app/guilds/${guild.id}`}
                  className="rounded-lg bg-nx-accent px-3 py-2 text-sm font-medium text-white shadow-glow-sm"
                >
                  Öffnen
                </Link>
              ) : (
                <a
                  href={guild.inviteUrl ?? "#"}
                  className="rounded-lg border border-nx-border px-3 py-2 text-sm hover:border-nx-accent/50"
                >
                  Bot einladen
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
