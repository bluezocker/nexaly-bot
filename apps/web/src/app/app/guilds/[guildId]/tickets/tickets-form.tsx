"use client";

import { useState, type ReactNode } from "react";

type Settings = {
  enabled: boolean;
  panelChannelId: string | null;
  categoryId: string | null;
  staffRoleId: string | null;
  logChannelId: string | null;
  panelTitle: string;
  panelText: string;
  openMessage: string;
};

type Ticket = { id: string; number: number; channelId: string; status: string; createdAt: string };

export function TicketsForm(props: {
  guildId: string;
  settings: Settings;
  tickets: Ticket[];
  channels: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}) {
  const [settings, setSettings] = useState(props.settings);
  const [status, setStatus] = useState<string | null>(null);

  function patch(partial: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...partial }));
  }

  function payload() {
    const id = (value: string | null) => (value && /^\d{17,20}$/.test(value) ? value : null);
    return {
      enabled: settings.enabled,
      panelChannelId: id(settings.panelChannelId),
      categoryId: id(settings.categoryId),
      staffRoleId: id(settings.staffRoleId),
      logChannelId: id(settings.logChannelId),
      panelTitle: settings.panelTitle.trim(),
      panelText: settings.panelText.trim(),
      openMessage: settings.openMessage.trim(),
    };
  }

  async function save() {
    setStatus(null);
    const response = await fetch(`/api/guilds/${props.guildId}/tickets`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setStatus(body?.error?.message ?? "Speichern fehlgeschlagen");
      return;
    }
    setStatus("Gespeichert");
  }

  async function panel() {
    setStatus(null);
    const saved = await fetch(`/api/guilds/${props.guildId}/tickets`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    if (!saved.ok) {
      const body = (await saved.json().catch(() => null)) as { error?: { message?: string } } | null;
      setStatus(body?.error?.message ?? "Speichern fehlgeschlagen");
      return;
    }
    const response = await fetch(`/api/guilds/${props.guildId}/tickets/panel`, { method: "POST" });
    setStatus(response.ok ? "Panel gesendet" : "Panel fehlgeschlagen. Kanal, Kategorie und Team-Rolle müssen gesetzt sein.");
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
        <h2 className="text-lg font-semibold">Tickets</h2>
        <p className="mt-1 text-sm text-nx-muted">
          Der Bot braucht die Berechtigung Kanäle verwalten. Die Team-Rolle sieht neue Tickets, alle anderen nicht.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
          Aktiv
        </label>
        <div className="mt-4 grid gap-3">
          <Field label="Panel-Kanal">
            <Select
              value={settings.panelChannelId ?? ""}
              onChange={(value) => patch({ panelChannelId: value || null })}
              options={props.channels}
              empty="Kanal"
            />
          </Field>
          <Field label="Kategorie">
            <Select
              value={settings.categoryId ?? ""}
              onChange={(value) => patch({ categoryId: value || null })}
              options={props.categories}
              empty="Kategorie"
            />
          </Field>
          <Field label="Team-Rolle">
            <Select
              value={settings.staffRoleId ?? ""}
              onChange={(value) => patch({ staffRoleId: value || null })}
              options={props.roles}
              empty="Rolle"
            />
          </Field>
          <Field label="Log-Kanal, optional">
            <Select
              value={settings.logChannelId ?? ""}
              onChange={(value) => patch({ logChannelId: value || null })}
              options={props.channels}
              empty="Keiner"
            />
          </Field>
          <Field label="Titel">
            <input className="w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={settings.panelTitle} onChange={(e) => patch({ panelTitle: e.target.value })} />
          </Field>
          <Field label="Panel-Text">
            <textarea className="min-h-20 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={settings.panelText} onChange={(e) => patch({ panelText: e.target.value })} />
          </Field>
          <Field label="Nachricht im Ticket">
            <textarea className="min-h-20 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={settings.openMessage} onChange={(e) => patch({ openMessage: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void save()} className="rounded-xl bg-nx-accent px-4 py-2 text-sm font-semibold">Speichern</button>
          <button type="button" onClick={() => void panel()} className="rounded-xl border border-nx-border px-4 py-2 text-sm">Panel senden</button>
          {status ? <span className="text-sm text-nx-muted">{status}</span> : null}
        </div>
      </section>
      <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">Letzte Tickets</h3>
        {props.tickets.length === 0 ? (
          <p className="mt-3 text-sm text-nx-muted">Noch keine Tickets.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {props.tickets.map((ticket) => (
              <li key={ticket.id} className="flex justify-between gap-3 text-nx-muted">
                <span>#{ticket.number}</span>
                <span>{ticket.status === "open" ? "Offen" : "Geschlossen"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-nx-muted">{label}</span>
      {children}
    </label>
  );
}

function Select(props: {
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  empty: string;
}) {
  return (
    <select
      className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    >
      <option value="">{props.empty}</option>
      {props.options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
}
