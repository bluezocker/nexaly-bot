import { notFound, redirect } from "next/navigation";
import { ApiError, apiFetch, type GuildDetails, type Me } from "@/lib/api";
import { GuildNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  try {
    const [guild, me] = await Promise.all([
      apiFetch<GuildDetails>(`/v1/guilds/${guildId}`),
      apiFetch<Me>("/v1/me"),
    ]);
    const displayName = me.globalName ?? me.username ?? "Discord";
    return (
      <div className="flex min-h-screen flex-col md:flex-row">
        <GuildNav guildId={guild.id} me={{ ...me, username: me.username ?? "user", globalName: displayName }} />
        <div className="min-w-0 flex-1">
          <header className="border-b border-nx-border px-6 py-4">
            <h1 className="text-lg font-semibold">{guild.name}</h1>
            <p className="text-xs text-nx-muted">{guild.memberCount ?? "–"} Mitglieder</p>
          </header>
          <div className="p-6">{children}</div>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    const message = error instanceof ApiError ? error.message : "Unbekannter Serverfehler";
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Server nicht erreichbar</h1>
        <p className="mt-2 text-sm text-nx-muted">{message}</p>
      </div>
    );
  }
}
