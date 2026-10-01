"use client";

import { useState } from "react";

type Reward = { level: number; roleId: string };

export function LevelsForm(props: {
  guildId: string;
  enabled: boolean;
  settings: {
    xpMin?: number;
    xpMax?: number;
    cooldownSec?: number;
    announceChannelId?: string | null;
    stackRoles?: boolean;
    ignoredChannelIds?: string[];
    ignoredRoleIds?: string[];
  } | null;
  rewards: Reward[];
  leaderboard: { userId: string; xp: number; level: number }[];
  channels: { id: string; name: string }[];
}) {
  const [enabled, setEnabled] = useState(props.enabled);
  const [xpMin, setXpMin] = useState(props.settings?.xpMin ?? 15);
  const [xpMax, setXpMax] = useState(props.settings?.xpMax ?? 25);
  const [cooldownSec, setCooldownSec] = useState(props.settings?.cooldownSec ?? 60);
  const [announceChannelId, setAnnounceChannelId] = useState(props.settings?.announceChannelId ?? "");
  const [stackRoles, setStackRoles] = useState(props.settings?.stackRoles ?? true);
  const [ignoredChannels, setIgnoredChannels] = useState((props.settings?.ignoredChannelIds ?? []).join(", "));
  const [rewards, setRewards] = useState(props.rewards);
  const [newLevel, setNewLevel] = useState(5);
  const [newRole, setNewRole] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setStatus("saving");
    const body = {
      enabled,
      xpMin,
      xpMax,
      cooldownSec,
      announceChannelId: announceChannelId || null,
      stackRoles,
      ignoredChannelIds: ignoredChannels.split(",").map((s) => s.trim()).filter(Boolean),
      ignoredRoleIds: props.settings?.ignoredRoleIds ?? [],
      rewards,
    };
    const response = await fetch(`/api/guilds/${props.guildId}/levels`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(payload?.error?.message ?? "Speichern fehlgeschlagen");
      setStatus("error");
      return;
    }
    setStatus("saved");
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between rounded-2xl border border-nx-border bg-nx-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Levelsystem</h2>
          <p className="mt-1 text-sm text-nx-muted">
            XP pro Nachricht mit Cooldown. Kurve: 5n² + 50n + 100. Commands: /rank, /leaderboard.
          </p>
        </div>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      </section>

      <section className="grid gap-4 rounded-2xl border border-nx-border bg-nx-card p-5 sm:grid-cols-2">
        <label className="text-sm">
          XP min
          <input type="number" className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2" value={xpMin} onChange={(e) => setXpMin(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          XP max
          <input type="number" className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2" value={xpMax} onChange={(e) => setXpMax(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          Cooldown (Sek.)
          <input type="number" className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2" value={cooldownSec} onChange={(e) => setCooldownSec(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          Level-up Kanal
          <select className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2" value={announceChannelId} onChange={(e) => setAnnounceChannelId(e.target.value)}>
            <option value="">Aktueller Kanal</option>
            {props.channels.map((channel) => (
              <option key={channel.id} value={channel.id}>#{channel.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={stackRoles} onChange={(e) => setStackRoles(e.target.checked)} />
          Rollen stapeln
        </label>
        <label className="sm:col-span-2 text-sm">
          Ignorierte Kanal-IDs
          <input className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2" value={ignoredChannels} onChange={(e) => setIgnoredChannels(e.target.value)} />
        </label>
      </section>

      <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">Rollenbelohnungen</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <input type="number" className="w-24 rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" value={newLevel} onChange={(e) => setNewLevel(Number(e.target.value))} />
          <input className="flex-1 rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm" placeholder="Rollen-ID" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
          <button
            type="button"
            className="rounded-lg bg-nx-accent px-3 py-2 text-sm"
            onClick={() => {
              if (!/^\d{17,20}$/.test(newRole)) return;
              setRewards((current) => [...current.filter((r) => r.level !== newLevel), { level: newLevel, roleId: newRole }]);
              setNewRole("");
            }}
          >
            Hinzufügen
          </button>
        </div>
        <ul className="mt-3 space-y-1 text-sm text-nx-muted">
          {rewards.map((reward) => (
            <li key={`${reward.level}-${reward.roleId}`} className="flex justify-between">
              Level {reward.level} → {reward.roleId}
              <button type="button" onClick={() => setRewards((current) => current.filter((r) => r !== reward))}>
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">Leaderboard</h3>
        {props.leaderboard.length === 0 ? (
          <p className="mt-2 text-sm text-nx-muted">Noch keine XP.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-nx-muted">
            {props.leaderboard.map((row, index) => (
              <li key={row.userId}>
                #{index + 1} {row.userId} · Lvl {row.level} · {row.xp} XP
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void save()} className="rounded-xl bg-nx-accent px-4 py-2 text-sm font-semibold">
          Speichern
        </button>
        <span className="text-sm text-nx-muted">{status === "saved" ? "Gespeichert" : status === "error" ? error : null}</span>
      </div>
    </div>
  );
}
