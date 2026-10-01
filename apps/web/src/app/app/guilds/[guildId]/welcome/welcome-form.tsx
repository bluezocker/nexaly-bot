"use client";

import { useState } from "react";

type Settings = {
  enabled: boolean;
  channelId: string | null;
  sendDm: boolean;
  dmTemplate: string | null;
  mode: "TEXT" | "EMBED" | "IMAGE";
  textTemplate: string | null;
  embedJson: { title?: string; description?: string; color?: number } | null;
  backgroundAssetId: string | null;
  textColor: string;
  accentColor: string;
  avatarX: number;
  avatarY: number;
  nameX: number;
  nameY: number;
  customText: string | null;
};

const fallback: Settings = {
  enabled: false,
  channelId: null,
  sendDm: false,
  dmTemplate: "Willkommen auf {server}!",
  mode: "EMBED",
  textTemplate: "Willkommen {user} auf **{server}** — du bist Mitglied #{memberCount}.",
  embedJson: { title: "Willkommen", description: "Willkommen {user} auf {server}!" },
  backgroundAssetId: null,
  textColor: "#FFFFFF",
  accentColor: "#7C5CFF",
  avatarX: 0.5,
  avatarY: 0.35,
  nameX: 0.5,
  nameY: 0.62,
  customText: "Willkommen",
};

export function WelcomeForm(props: {
  guildId: string;
  enabled: boolean;
  settings: Partial<Settings> | null;
  channels: { id: string; name: string }[];
}) {
  const [form, setForm] = useState<Settings>({
    ...fallback,
    ...props.settings,
    enabled: props.enabled,
    embedJson: props.settings?.embedJson ?? fallback.embedJson,
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function patch<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    const body = {
      enabled: form.enabled,
      channelId: form.channelId || null,
      sendDm: form.sendDm,
      dmTemplate: form.dmTemplate?.trim() ? form.dmTemplate : null,
      mode: form.mode,
      textTemplate: form.textTemplate?.trim() ? form.textTemplate : null,
      embedJson: form.embedJson,
      backgroundAssetId: form.backgroundAssetId,
      textColor: /^#?[0-9a-fA-F]{6}$/.test(form.textColor) ? form.textColor : "#FFFFFF",
      accentColor: /^#?[0-9a-fA-F]{6}$/.test(form.accentColor) ? form.accentColor : "#7C5CFF",
      avatarX: form.avatarX,
      avatarY: form.avatarY,
      nameX: form.nameX,
      nameY: form.nameY,
      customText: form.customText?.trim() ? form.customText : null,
    };
    const response = await fetch(`/api/guilds/${props.guildId}/welcome`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setStatus("error");
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Speichern fehlgeschlagen");
      return;
    }
    setStatus("saved");
  }

  async function preview() {
    await save();
    const response = await fetch(`/api/guilds/${props.guildId}/welcome/preview`, { method: "POST" });
    if (!response.ok) {
      setError("Vorschau braucht den Worker");
      setStatus("error");
      return;
    }
    const blob = await response.blob();
    setPreviewUrl(URL.createObjectURL(blob));
  }

  async function upload(file: File) {
    const data = await file.arrayBuffer();
    const bytes = new Uint8Array(data);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const b64 = btoa(binary);
    const mime = file.type === "image/jpeg" ? "image/jpeg" : file.type === "image/webp" ? "image/webp" : "image/png";
    const response = await fetch(`/api/guilds/${props.guildId}/welcome/background`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mime, data: b64 }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { assetId: string };
    patch("backgroundAssetId", body.assetId);
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between rounded-2xl border border-nx-border bg-nx-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Willkommen</h2>
          <p className="mt-1 text-sm text-nx-muted">
            Platzhalter: {"{user}"}, {"{user.name}"}, {"{server}"}, {"{memberCount}"}. Bildkarten erzeugt der Worker.
          </p>
        </div>
        <input type="checkbox" checked={form.enabled} onChange={(e) => patch("enabled", e.target.checked)} />
      </section>

      <section className="grid gap-4 rounded-2xl border border-nx-border bg-nx-card p-5 sm:grid-cols-2">
        <label className="text-sm">
          Kanal
          <select
            className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2"
            value={form.channelId ?? ""}
            onChange={(e) => patch("channelId", e.target.value || null)}
          >
            <option value="">Kein Kanal</option>
            {props.channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Modus
          <select
            className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2"
            value={form.mode}
            onChange={(e) => patch("mode", e.target.value as Settings["mode"])}
          >
            <option value="TEXT">Text</option>
            <option value="EMBED">Embed</option>
            <option value="IMAGE">Bildkarte</option>
          </select>
        </label>
        <label className="sm:col-span-2 text-sm">
          Textvorlage
          <textarea
            className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2"
            rows={3}
            value={form.textTemplate ?? ""}
            onChange={(e) => patch("textTemplate", e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.sendDm} onChange={(e) => patch("sendDm", e.target.checked)} />
          Zusätzlich per DM
        </label>
        <label className="text-sm">
          DM-Text
          <input
            className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2"
            value={form.dmTemplate ?? ""}
            onChange={(e) => patch("dmTemplate", e.target.value)}
          />
        </label>
      </section>

      {form.mode === "IMAGE" ? (
        <section className="grid gap-4 rounded-2xl border border-nx-border bg-nx-card p-5 sm:grid-cols-2">
          <label className="text-sm">
            Textfarbe
            <input type="color" value={form.textColor} onChange={(e) => patch("textColor", e.target.value)} />
          </label>
          <label className="text-sm">
            Akzent
            <input type="color" value={form.accentColor} onChange={(e) => patch("accentColor", e.target.value)} />
          </label>
          {(["avatarX", "avatarY", "nameX", "nameY"] as const).map((key) => (
            <label key={key} className="text-sm">
              {key} ({form[key].toFixed(2)})
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={form[key]}
                onChange={(e) => patch(key, Number(e.target.value))}
                className="w-full"
              />
            </label>
          ))}
          <label className="sm:col-span-2 text-sm">
            Bildtext
            <input
              className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2"
              value={form.customText ?? ""}
              onChange={(e) => patch("customText", e.target.value)}
            />
          </label>
          <label className="sm:col-span-2 text-sm">
            Hintergrund (max. 2 MB)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mt-1 block"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </label>
        </section>
      ) : null}

      {previewUrl ? (
        <img src={previewUrl} alt="Willkommensvorschau" className="max-w-full rounded-2xl border border-nx-border" />
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void save()} className="rounded-xl bg-nx-accent px-4 py-2 text-sm font-semibold">
          Speichern
        </button>
        {form.mode === "IMAGE" ? (
          <button type="button" onClick={() => void preview()} className="rounded-xl border border-nx-border px-4 py-2 text-sm">
            Vorschau
          </button>
        ) : null}
        <span className="text-sm text-nx-muted">
          {status === "saved" ? "Gespeichert" : status === "error" ? error : null}
        </span>
      </div>
    </div>
  );
}
