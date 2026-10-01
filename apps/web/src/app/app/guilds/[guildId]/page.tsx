import { apiFetch, type GuildDetails } from "@/lib/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

const MODULE_HREF: Record<string, string> = {
  logs: "logs",
  moderation: "moderation",
  welcome: "welcome",
  levels: "levels",
  streams: "streams",
  embeds: "embeds",
  tickets: "tickets",
  social: "social",
};

const MODULE_LABEL: Record<string, string> = {
  logs: "Logs",
  moderation: "Moderation",
  welcome: "Willkommen",
  levels: "Level",
  streams: "Live-Alerts",
  embeds: "Embeds",
  tickets: "Tickets",
  social: "Social",
};

export default async function GuildOverviewPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const guild = await apiFetch<GuildDetails>(`/v1/guilds/${guildId}`);
  const enabled = guild.modules.filter((m) => m.enabled).length;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Card title="Bot-Status" value="Installiert" />
      <Card title="Mitglieder" value={String(guild.memberCount ?? "–")} />
      <Card title="Aktive Module" value={`${enabled} / ${Object.keys(MODULE_LABEL).length}`} />
      {Object.keys(MODULE_LABEL).map((key) => {
        const row = guild.modules.find((module) => module.key === key);
        return (
          <Link key={key} href={`/app/guilds/${guildId}/${MODULE_HREF[key]}`}>
            <Card title={MODULE_LABEL[key] ?? key} value={row?.enabled ? "An" : "Aus"} />
          </Link>
        );
      })}
    </div>
  );
}

function Card({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <section className="rounded-2xl border border-nx-border bg-nx-card p-5 transition hover:border-nx-accent/40">
      <p className="text-xs uppercase tracking-wide text-nx-muted">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-2 text-xs text-nx-muted">{hint}</p> : null}
    </section>
  );
}
