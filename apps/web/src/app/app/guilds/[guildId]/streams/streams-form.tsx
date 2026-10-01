"use client";

import { useState } from "react";

type Sub = {
  id: string;
  platform: string;
  channelKey: string;
  displayName: string;
  announceChannelId: string;
  mentionRoleId: string | null;
  enabled: boolean;
};

export function StreamsForm(props: {
  guildId: string;
  subscriptions: Sub[];
  providers: Record<string, boolean>;
  channels: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}) {
  const [subs, setSubs] = useState(props.subscriptions);
  const [platform, setPlatform] = useState<"TWITCH" | "YOUTUBE" | "KICK">("TWITCH");
  const [channelKey, setChannelKey] = useState("");
  const [announceChannelId, setAnnounceChannelId] = useState(props.channels[0]?.id ?? "");
  const [mentionRoleId, setMentionRoleId] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function add() {
    const response = await fetch(`/api/guilds/${props.guildId}/streams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        channelKey,
        announceChannelId,
        mentionRoleId: mentionRoleId || null,
        template: null,
        enabled: true,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setStatus(body?.error?.message ?? "Kanal konnte nicht geprüft werden");
      return;
    }
    const payload = (await response.json()) as { subscription: Sub };
    setSubs((current) => [...current, payload.subscription]);
    setChannelKey("");
    setStatus("Hinzugefügt");
  }

  async function remove(id: string) {
    await fetch(`/api/guilds/${props.guildId}/streams/${id}`, { method: "DELETE" });
    setSubs((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
        <h2 className="text-lg font-semibold">Live-Ankündigungen</h2>
        <p className="mt-1 text-sm text-nx-muted">
          Twitch Helix, YouTube Data API v3 (Polling, Quota), Kick Public API. Ohne API-Keys kein Live-Status.
          Die Rolle wird beim Live-Gang erwähnt. Normale Rollen müssen in Discord erwähnbar sein. @everyone braucht beim Bot die Berechtigung „Alle erwähnen“.
          In anderen Modulen fehlt @everyone, weil die Rolle dort nicht vergeben werden darf.
          Bestehende Alerts neu anlegen, wenn die Rolle noch fehlt.
        </p>
        <ul className="mt-3 flex gap-3 text-xs text-nx-muted">
          {Object.entries(props.providers).map(([name, ok]) => (
            <li key={name}>
              {name}: {ok ? "konfiguriert" : "fehlt"}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 rounded-2xl border border-nx-border bg-nx-card p-5 sm:grid-cols-2">
        <select className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
          <option value="TWITCH">Twitch Login</option>
          <option value="YOUTUBE">YouTube Handle/UC-ID</option>
          <option value="KICK">Kick Slug</option>
        </select>
        <input className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={channelKey} onChange={(e) => setChannelKey(e.target.value)} placeholder="Kanal" />
        <select className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={announceChannelId} onChange={(e) => setAnnounceChannelId(e.target.value)}>
          {props.channels.map((channel) => (
            <option key={channel.id} value={channel.id}>#{channel.name}</option>
          ))}
        </select>
        <select className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={mentionRoleId} onChange={(e) => setMentionRoleId(e.target.value)}>
          <option value="">Keine Erwähnung</option>
          <option value={props.guildId}>@everyone</option>
          {props.roles.map((role) => (
            <option key={role.id} value={role.id}>@{role.name}</option>
          ))}
        </select>
        <button type="button" onClick={() => void add()} className="rounded-xl bg-nx-accent px-4 py-2 text-sm font-semibold">
          Validieren & speichern
        </button>
        <p className="sm:col-span-2 text-sm text-nx-muted">{status}</p>
      </section>

      <ul className="space-y-2 rounded-2xl border border-nx-border bg-nx-card p-5 text-sm">
        {subs.length === 0 ? <li className="text-nx-muted">Keine Abos.</li> : null}
        {subs.map((sub) => (
          <li key={sub.id} className="flex justify-between">
            <span>
              {sub.platform} · {sub.displayName} ({sub.channelKey})
              {sub.mentionRoleId
                ? ` · ${sub.mentionRoleId === props.guildId ? "@everyone" : `@${props.roles.find((role) => role.id === sub.mentionRoleId)?.name ?? "Rolle"}`}`
                : ""}
            </span>
            <button type="button" className="text-red-300" onClick={() => void remove(sub.id)}>
              Entfernen
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
