import { ApiBanner } from "@/lib/api-banner";
import { apiFetchSafe } from "@/lib/api";
import { LogsForm } from "./logs-form";

export const dynamic = "force-dynamic";

type LogsPayload = {
  enabled: boolean;
  events: Record<string, { enabled: boolean; channelId: string | null }>;
  catalog: { key: string; label: string; group: string }[];
};

type ChannelsPayload = { channels: { id: string; name: string }[] };

type RecentPayload = {
  events: { id: string; eventKey: string; actorId: string | null; createdAt: string }[];
};

export default async function LogsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const [settings, channels, recent] = await Promise.all([
    apiFetchSafe<LogsPayload>(`/v1/guilds/${guildId}/logs`, {
      enabled: false,
      events: {},
      catalog: [],
    }),
    apiFetchSafe<ChannelsPayload>(`/v1/guilds/${guildId}/channels`, { channels: [] }),
    apiFetchSafe<RecentPayload>(`/v1/guilds/${guildId}/logs/recent`, { events: [] }),
  ]);

  return (
    <div className="space-y-8">
      <ApiBanner error={settings.error ?? channels.error ?? recent.error} />
      <LogsForm
        guildId={guildId}
        enabled={settings.data.enabled}
        events={settings.data.events ?? {}}
        catalog={settings.data.catalog ?? []}
        channels={channels.data.channels ?? []}
      />
      <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">
          Letzte Ereignisse
        </h3>
        {recent.data.events.length === 0 ? (
          <p className="mt-3 text-sm text-nx-muted">Noch keine gespeicherten Log-Einträge.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {recent.data.events.map((event) => (
              <li key={event.id} className="flex justify-between gap-4 text-nx-muted">
                <span>{event.eventKey}</span>
                <span>
                  {event.actorId ? `Akteur ${event.actorId}` : "kein Akteur"}
                  {" · "}
                  {event.createdAt ? new Date(event.createdAt).toLocaleString("de-DE") : "–"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
