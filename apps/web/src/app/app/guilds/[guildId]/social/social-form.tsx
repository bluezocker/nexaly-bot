"use client";

import { useState } from "react";

type Sub = {
  id: string;
  platform: string;
  accountKey: string;
  displayName: string;
  announceChannelId: string;
  enabled: boolean;
  lastError: string | null;
  connected: boolean;
};

export function SocialForm(props: {
  guildId: string;
  subscriptions: Sub[];
  providers: { X: boolean; THREADS: boolean };
  channels: { id: string; name: string }[];
  notice: string | null;
}) {
  const [subs, setSubs] = useState(props.subscriptions);
  const [handle, setHandle] = useState("");
  const [channelId, setChannelId] = useState(props.channels[0]?.id ?? "");
  const [status, setStatus] = useState<string | null>(props.notice);

  async function addX() {
    setStatus(null);
    const response = await fetch(`/api/guilds/${props.guildId}/social`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "X", handle, announceChannelId: channelId }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setStatus(body?.error?.message ?? "X-Account konnte nicht geprüft werden");
      return;
    }
    const payload = (await response.json()) as { subscription: Sub };
    setSubs((current) => [payload.subscription, ...current.filter((row) => row.id !== payload.subscription.id)]);
    setHandle("");
    setStatus("Hinzugefügt. Der letzte Post wird nicht nachträglich gesendet.");
  }

  async function remove(id: string) {
    await fetch(`/api/guilds/${props.guildId}/social/${id}`, { method: "DELETE" });
    setSubs((current) => current.filter((row) => row.id !== id));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
        <h2 className="text-lg font-semibold">Social</h2>
        <p className="mt-1 text-sm text-nx-muted">
          Neue eigene Posts erscheinen im gewählten Kanal. Antworten und Reposts nicht. Alte Posts werden nicht nachgeholt.
          Abfrage etwa alle fünf Minuten.
        </p>
        <ul className="mt-3 flex gap-3 text-xs text-nx-muted">
          <li>X: {props.providers.X ? "konfiguriert" : "fehlt"}</li>
          <li>Threads: {props.providers.THREADS ? "konfiguriert" : "fehlt"}</li>
        </ul>
      </section>

      <section className="grid gap-3 rounded-2xl border border-nx-border bg-nx-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">X</h3>
        <p className="text-sm text-nx-muted">
          Öffentlicher Benutzername. Die App auf dem Server braucht ein Bearer-Token mit Lesezugriff auf User-Timelines.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@name"
          />
          <ChannelSelect channels={props.channels} value={channelId} onChange={setChannelId} />
        </div>
        <button type="button" onClick={() => void addX()} className="w-fit rounded-xl bg-nx-accent px-4 py-2 text-sm font-semibold">
          X hinzufügen
        </button>
      </section>

      <section className="grid gap-3 rounded-2xl border border-nx-border bg-nx-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">Threads</h3>
        <p className="text-sm text-nx-muted">
          Nur das Konto, das sich hier anmeldet. Meta liefert fremde Profile im Standardzugang nicht, deshalb gibt es keine Suche nach beliebigen Namen.
        </p>
        <ChannelSelect channels={props.channels} value={channelId} onChange={setChannelId} />
        <a
          href={`/api/auth/threads?guildId=${props.guildId}&channelId=${channelId}`}
          className="w-fit rounded-xl border border-nx-border px-4 py-2 text-sm"
        >
          Mit Threads verbinden
        </a>
      </section>

      {status ? <p className="text-sm text-nx-muted">{status}</p> : null}

      <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">Konten</h3>
        {subs.length === 0 ? (
          <p className="mt-3 text-sm text-nx-muted">Noch keine Konten.</p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {subs.map((sub) => (
              <li key={sub.id} className="flex items-start justify-between gap-3">
                <span>
                  {sub.platform} · @{sub.accountKey}
                  {sub.lastError ? <span className="mt-1 block text-red-300">{sub.lastError}</span> : null}
                </span>
                <button type="button" className="text-red-300" onClick={() => void remove(sub.id)}>
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ChannelSelect(props: {
  channels: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    >
      {props.channels.map((channel) => (
        <option key={channel.id} value={channel.id}>
          #{channel.name}
        </option>
      ))}
    </select>
  );
}
