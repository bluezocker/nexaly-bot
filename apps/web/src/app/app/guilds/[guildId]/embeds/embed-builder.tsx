"use client";

import { useState } from "react";

type Embed = {
  title?: string;
  description?: string;
  color?: number;
  footer?: string;
  author?: string;
  image?: string;
  thumbnail?: string;
  fields: { name: string; value: string; inline?: boolean }[];
};

type Template = { id: string; name: string; content: string | null; embed: Embed };
type Reaction = { emoji: string; roleId: string };
type Binding = { id: string; channelId: string; messageId: string; emoji: string; roleId: string };

const emptyEmbed: Embed = { title: "Nexaly", description: "Neue Nachricht", color: 0x7c5cff, fields: [] };

export function EmbedBuilder(props: {
  guildId: string;
  templates: Template[];
  channels: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  bindings: Binding[];
}) {
  const [templates, setTemplates] = useState(props.templates);
  const [name, setName] = useState("Ankündigung");
  const [content, setContent] = useState("");
  const [embed, setEmbed] = useState<Embed>(emptyEmbed);
  const [selected, setSelected] = useState<string | null>(null);
  const [channelId, setChannelId] = useState(props.channels[0]?.id ?? "");
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [bindings, setBindings] = useState(props.bindings);
  const [existingMessage, setExistingMessage] = useState("");
  const [existingReactions, setExistingReactions] = useState<Reaction[]>([
    { emoji: "✅", roleId: props.roles[0]?.id ?? "" },
  ]);
  const [status, setStatus] = useState<string | null>(null);

  function patch(partial: Partial<Embed>) {
    setEmbed((current) => ({ ...current, ...partial }));
  }

  async function save() {
    const body = { name, content, embed };
    const url = selected
      ? `/api/guilds/${props.guildId}/embeds/${selected}`
      : `/api/guilds/${props.guildId}/embeds`;
    const response = await fetch(url, {
      method: selected ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setStatus("Speichern fehlgeschlagen — Limits prüfen");
      return;
    }
    if (!selected) {
      const payload = (await response.json()) as { template: Template };
      setTemplates((current) => [payload.template, ...current]);
      setSelected(payload.template.id);
    }
    setStatus("Gespeichert");
  }

  async function send() {
    const active = reactions.filter((reaction) => reaction.emoji.trim() && reaction.roleId);
    const response = await fetch(`/api/guilds/${props.guildId}/embeds/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, templateId: selected ?? undefined, content, embed, reactions: active }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setStatus(payload?.error?.message ?? "Senden fehlgeschlagen");
      return;
    }
    const payload = (await response.json()) as { warnings?: string[]; bindings?: Binding[] };
    setReactions([]);
    if (payload.bindings?.length) setBindings((current) => [...payload.bindings!, ...current]);
    setStatus(payload.warnings?.length ? `Gesendet, Reaktion: ${payload.warnings.join("; ")}` : "Gesendet");
  }

  async function remove(id: string) {
    await fetch(`/api/guilds/${props.guildId}/embeds/${id}`, { method: "DELETE" });
    setTemplates((current) => current.filter((item) => item.id !== id));
    if (selected === id) setSelected(null);
  }

  const colorHex = `#${(embed.color ?? 0x7c5cff).toString(16).padStart(6, "0")}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
          <h2 className="text-lg font-semibold">Embed-Builder</h2>
          <p className="mt-1 text-sm text-nx-muted">Discord-Limits: Titel 256, Beschreibung 4096, 25 Felder.</p>
          <div className="mt-4 grid gap-3">
            <input className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vorlagenname" />
            <input className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nachrichtentext über dem Embed" />
            <input className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={embed.title ?? ""} onChange={(e) => patch({ title: e.target.value })} placeholder="Titel" />
            <textarea className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" rows={4} value={embed.description ?? ""} onChange={(e) => patch({ description: e.target.value })} placeholder="Beschreibung" />
            <label className="text-sm text-nx-muted">
              Farbe
              <input
                type="color"
                className="ml-2"
                value={colorHex}
                onChange={(e) => patch({ color: parseInt(e.target.value.slice(1), 16) })}
              />
            </label>
            <input className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={embed.footer ?? ""} onChange={(e) => patch({ footer: e.target.value })} placeholder="Footer" />
            <input className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={embed.image ?? ""} onChange={(e) => patch({ image: e.target.value })} placeholder="Bild-URL" />
          </div>
          <button
            type="button"
            className="mt-3 text-sm text-nx-accent"
            onClick={() => patch({ fields: [...embed.fields, { name: "Feld", value: "Wert" }] })}
          >
            Feld hinzufügen
          </button>
          <ul className="mt-2 space-y-2">
            {embed.fields.map((field, index) => (
              <li key={index} className="grid gap-2 sm:grid-cols-2">
                <input className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={field.name} onChange={(e) => {
                  const fields = [...embed.fields];
                  fields[index] = { ...field, name: e.target.value };
                  patch({ fields });
                }} />
                <input className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={field.value} onChange={(e) => {
                  const fields = [...embed.fields];
                  fields[index] = { ...field, value: e.target.value };
                  patch({ fields });
                }} />
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap gap-3">
          <select className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            {props.channels.map((channel) => (
              <option key={channel.id} value={channel.id}>#{channel.name}</option>
            ))}
          </select>
          <button type="button" onClick={() => void save()} className="rounded-xl bg-nx-accent px-4 py-2 text-sm font-semibold">Speichern</button>
          <button type="button" onClick={() => void send()} className="rounded-xl border border-nx-border px-4 py-2 text-sm">Senden</button>
          <span className="text-sm text-nx-muted">{status}</span>
        </div>

        <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">Reaktion → Rolle</h3>
          <p className="mt-1 text-sm text-nx-muted">
            Mehrere Zeilen sind mehrere Reaktionen auf derselben Nachricht, jede mit eigener Rolle. Bis zu 20.
            Der Bot setzt sie nacheinander. Klick vergibt die Rolle, Entfernen nimmt sie wieder weg.
            Die Rolle muss unter der Bot-Rolle liegen.
          </p>
          <ul className="mt-3 space-y-2">
            {reactions.map((reaction, index) => (
              <li key={index} className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                <input
                  className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm"
                  placeholder="💙, :blue_heart: oder <:name:id>"
                  value={reaction.emoji}
                  onChange={(e) => {
                    const next = [...reactions];
                    next[index] = { ...reaction, emoji: e.target.value };
                    setReactions(next);
                  }}
                />
                <select
                  className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm"
                  value={reaction.roleId}
                  onChange={(e) => {
                    const next = [...reactions];
                    next[index] = { ...reaction, roleId: e.target.value };
                    setReactions(next);
                  }}
                >
                  <option value="">Rolle</option>
                  {props.roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="text-sm text-red-300" onClick={() => setReactions(reactions.filter((_, i) => i !== index))}>
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-3 text-sm text-nx-accent"
            onClick={() => setReactions([...reactions, { emoji: "✅", roleId: props.roles[0]?.id ?? "" }])}
          >
            Reaktion hinzufügen
          </button>
        </section>

        {bindings.length > 0 ? (
          <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">Aktive Reaktionsrollen</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {bindings.map((binding) => (
                <li key={binding.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-nx-muted">
                    {binding.emoji} → {props.roles.find((role) => role.id === binding.roleId)?.name ?? binding.roleId}
                  </span>
                  <button
                    type="button"
                    className="text-red-300"
                    onClick={async () => {
                      await fetch(`/api/guilds/${props.guildId}/embeds/reactions/${binding.id}`, { method: "DELETE" });
                      setBindings((current) => current.filter((row) => row.id !== binding.id));
                    }}
                  >
                    Lösen
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">Vorhandene Nachricht</h3>
          <p className="mt-1 text-sm text-nx-muted">
            Nachrichten-Link einfügen und mehrere Reaktionen auf dieselbe Nachricht setzen.
          </p>
          <div className="mt-3 grid gap-2">
            <input
              className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm"
              placeholder="https://discord.com/channels/… oder Nachrichten-ID"
              value={existingMessage}
              onChange={(e) => setExistingMessage(e.target.value)}
            />
            <ul className="space-y-2">
              {existingReactions.map((reaction, index) => (
                <li key={index} className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                  <input
                    className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm"
                    placeholder="💙 oder :blue_heart:"
                    value={reaction.emoji}
                    onChange={(e) => {
                      const next = [...existingReactions];
                      next[index] = { ...reaction, emoji: e.target.value };
                      setExistingReactions(next);
                    }}
                  />
                  <select
                    className="rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm"
                    value={reaction.roleId}
                    onChange={(e) => {
                      const next = [...existingReactions];
                      next[index] = { ...reaction, roleId: e.target.value };
                      setExistingReactions(next);
                    }}
                  >
                    <option value="">Rolle</option>
                    {props.roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-sm text-red-300"
                    onClick={() => setExistingReactions(existingReactions.filter((_, i) => i !== index))}
                  >
                    Entfernen
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="w-fit text-sm text-nx-accent"
              onClick={() =>
                setExistingReactions([...existingReactions, { emoji: "", roleId: props.roles[0]?.id ?? "" }])
              }
            >
              Weitere Reaktion
            </button>
            <button
              type="button"
              className="w-fit rounded-xl border border-nx-border px-4 py-2 text-sm"
              onClick={async () => {
                setStatus(null);
                const reactions = existingReactions.filter((reaction) => reaction.emoji.trim() && reaction.roleId);
                if (!reactions.length) {
                  setStatus("Mindestens eine Reaktion mit Rolle angeben");
                  return;
                }
                const response = await fetch(`/api/guilds/${props.guildId}/embeds/reactions`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    channelId: channelId || undefined,
                    message: existingMessage,
                    reactions,
                  }),
                });
                if (!response.ok) {
                  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
                  setStatus(payload?.error?.message ?? "Konnte nicht an die Nachricht gehängt werden");
                  return;
                }
                const payload = (await response.json()) as { bindings?: Binding[]; warnings?: string[] };
                if (payload.bindings?.length) {
                  setBindings((current) => {
                    const ids = new Set(payload.bindings!.map((row) => row.id));
                    return [...payload.bindings!, ...current.filter((row) => !ids.has(row.id))];
                  });
                }
                setStatus(
                  payload.warnings?.length
                    ? `Gesetzt, aber: ${payload.warnings.join("; ")}`
                    : `${payload.bindings?.length ?? 0} Reaktionen gesetzt`,
                );
              }}
            >
              An Nachricht hängen
            </button>
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-nx-border bg-nx-card p-4">
          <p className="text-xs uppercase text-nx-muted">Vorschau</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-nx-border" style={{ borderLeft: `4px solid ${colorHex}` }}>
            <div className="bg-nx-elevated p-4">
              <p className="font-semibold">{embed.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-nx-muted">{embed.description}</p>
              {embed.fields.map((field, index) => (
                <p key={index} className="mt-2 text-sm"><strong>{field.name}</strong><br />{field.value}</p>
              ))}
              {embed.footer ? <p className="mt-3 text-xs text-nx-muted">{embed.footer}</p> : null}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-nx-border bg-nx-card p-4">
          <p className="text-xs uppercase text-nx-muted">Vorlagen</p>
          <ul className="mt-2 space-y-2 text-sm">
            {templates.map((template) => (
              <li key={template.id} className="flex justify-between gap-2">
                <button
                  type="button"
                  className="text-left"
                  onClick={() => {
                    setSelected(template.id);
                    setName(template.name);
                    setContent(template.content ?? "");
                    setEmbed({ ...template.embed, fields: template.embed.fields ?? [] });
                  }}
                >
                  {template.name}
                </button>
                <button type="button" className="text-red-300" onClick={() => void remove(template.id)}>×</button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
