"use client";

import { useMemo, useState } from "react";

type EventSetting = { enabled: boolean; channelId: string | null };
type CatalogItem = { key: string; label: string; group: string };
type Channel = { id: string; name: string };

const GROUPS = [
  { id: "messages", label: "Nachrichten" },
  { id: "members", label: "Mitglieder" },
  { id: "moderation", label: "Moderation" },
  { id: "roles", label: "Rollen" },
  { id: "channels", label: "Kanäle" },
  { id: "voice", label: "Voice" },
];

export function LogsForm(props: {
  guildId: string;
  enabled: boolean;
  events: Record<string, EventSetting>;
  catalog: CatalogItem[];
  channels: Channel[];
}) {
  const [enabled, setEnabled] = useState(props.enabled);
  const [events, setEvents] = useState(props.events);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return GROUPS.map((group) => ({
      ...group,
      items: props.catalog.filter((item) => item.group === group.id),
    }));
  }, [props.catalog]);

  async function save() {
    setStatus("saving");
    setError(null);
    const response = await fetch(`/api/guilds/${props.guildId}/logs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, events }),
    });
    if (!response.ok) {
      setStatus("error");
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Speichern fehlgeschlagen");
      return;
    }
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-nx-border bg-nx-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Server-Logs</h2>
          <p className="mt-1 max-w-xl text-sm text-nx-muted">
            Ereignisse als Embeds in gewählte Kanäle. Verantwortliche werden nur gesetzt, wenn der
            Audit-Log eindeutig ist – sonst bleibt das Feld leer.
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <span className="text-nx-muted">Modul</span>
          <button
            type="button"
            onClick={() => {
              setEnabled((value) => !value);
              setStatus("idle");
            }}
            className={`relative h-7 w-12 rounded-full transition ${enabled ? "bg-nx-accent" : "bg-nx-border"}`}
            aria-pressed={enabled}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                enabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        </label>
      </section>

      {grouped.map((group) => (
        <section key={group.id} className="rounded-2xl border border-nx-border bg-nx-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-nx-muted">
            {group.label}
          </h3>
          <ul className="space-y-3">
            {group.items.map((item) => {
              const setting = events[item.key] ?? { enabled: false, channelId: null };
              return (
                <li
                  key={item.key}
                  className="flex flex-col gap-3 border-t border-nx-border pt-3 first:border-t-0 first:pt-0 md:flex-row md:items-center"
                >
                  <label className="flex flex-1 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={setting.enabled}
                      onChange={(event) => {
                        setEvents((current) => ({
                          ...current,
                          [item.key]: { ...setting, enabled: event.target.checked },
                        }));
                        setStatus("idle");
                      }}
                      className="h-4 w-4 accent-[#7c5cff]"
                    />
                    {item.label}
                  </label>
                  <select
                    value={setting.channelId ?? ""}
                    onChange={(event) => {
                      setEvents((current) => ({
                        ...current,
                        [item.key]: {
                          ...setting,
                          channelId: event.target.value || null,
                        },
                      }));
                      setStatus("idle");
                    }}
                    className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm md:w-64"
                  >
                    <option value="">Kein Kanal</option>
                    {props.channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        #{channel.name}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={status === "saving"}
          className="rounded-xl bg-nx-accent px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {status === "saving" ? "Speichert…" : "Speichern"}
        </button>
        <p className="text-sm text-nx-muted">
          {status === "saved" ? "Gespeichert" : status === "error" ? error : "Änderungen gelten sofort für den Bot."}
        </p>
      </div>
    </div>
  );
}
