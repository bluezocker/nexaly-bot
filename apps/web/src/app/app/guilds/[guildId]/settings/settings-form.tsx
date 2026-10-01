"use client";

import { useState } from "react";

type ModuleRow = { key: string; label: string; enabled: boolean };
type Role = { id: string; name: string; color: number; managed: boolean };

const TIMEZONES = ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich", "Europe/London", "UTC"];

export function SettingsForm(props: {
  guildId: string;
  locale: string;
  timezone: string;
  managerRoleIds: string[];
  dataRetentionDays: number;
  deletedMessageLogDays: number;
  modules: ModuleRow[];
  roles: Role[];
}) {
  const [locale, setLocale] = useState(props.locale);
  const [timezone, setTimezone] = useState(props.timezone);
  const [managerRoleIds, setManagerRoleIds] = useState<string[]>(props.managerRoleIds);
  const [dataRetentionDays, setDataRetentionDays] = useState(props.dataRetentionDays);
  const [deletedMessageLogDays, setDeletedMessageLogDays] = useState(props.deletedMessageLogDays);
  const [modules, setModules] = useState(props.modules);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function toggleRole(id: string) {
    setManagerRoleIds((current) =>
      current.includes(id) ? current.filter((role) => role !== id) : [...current, id],
    );
    setStatus("idle");
  }

  function toggleModule(key: string) {
    setModules((current) =>
      current.map((row) => (row.key === key ? { ...row, enabled: !row.enabled } : row)),
    );
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    setError(null);
    const response = await fetch(`/api/guilds/${props.guildId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale,
        timezone,
        managerRoleIds,
        dataRetentionDays,
        deletedMessageLogDays,
        modules: modules.map((row) => ({ key: row.key, enabled: row.enabled })),
      }),
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
      <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
        <h2 className="text-lg font-semibold">Server-Einstellungen</h2>
        <p className="mt-1 text-sm text-nx-muted">
          Sprache, Zeitzone, Dashboard-Manager und Aufbewahrung. Gilt nur für diesen Server.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Sprache
            <select
              className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2"
              value={locale}
              onChange={(e) => {
                setLocale(e.target.value);
                setStatus("idle");
              }}
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="text-sm">
            Zeitzone
            <select
              className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2"
              value={timezone}
              onChange={(e) => {
                setTimezone(e.target.value);
                setStatus("idle");
              }}
            >
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Log-Aufbewahrung (Tage)
            <input
              type="number"
              min={7}
              max={365}
              className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2"
              value={dataRetentionDays}
              onChange={(e) => {
                setDataRetentionDays(Number(e.target.value));
                setStatus("idle");
              }}
            />
          </label>
          <label className="text-sm">
            Gelöschte Nachrichten (Tage)
            <input
              type="number"
              min={1}
              max={90}
              className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2"
              value={deletedMessageLogDays}
              onChange={(e) => {
                setDeletedMessageLogDays(Number(e.target.value));
                setStatus("idle");
              }}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">Module</h3>
        <p className="mt-1 text-sm text-nx-muted">Ein- und Ausschalten pro Server. Feineinstellungen in den jeweiligen Menüs.</p>
        <ul className="mt-4 divide-y divide-nx-border">
          {modules.map((row) => (
            <li key={row.key} className="flex items-center justify-between py-3">
              <span className="text-sm font-medium">{row.label}</span>
              <button
                type="button"
                onClick={() => toggleModule(row.key)}
                className={`h-7 w-12 rounded-full ${row.enabled ? "bg-nx-accent" : "bg-nx-border"}`}
                aria-pressed={row.enabled}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">Dashboard-Manager</h3>
        <p className="mt-1 text-sm text-nx-muted">
          Zusätzlich zu Owner, Administrator und Manage Server. Rollen vom Bot geladen.
        </p>
        {props.roles.length === 0 ? (
          <p className="mt-3 text-sm text-nx-muted">Keine Rollen geladen. Bot-Rechte oder Discord-Limit prüfen.</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {props.roles.map((role) => {
              const selected = managerRoleIds.includes(role.id);
              const color = role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#9b5cff";
              return (
                <li key={role.id}>
                  <button
                    type="button"
                    onClick={() => toggleRole(role.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                      selected ? "border-nx-accent bg-nx-accent/15" : "border-nx-border bg-nx-elevated"
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                    <span className="truncate">{role.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={status === "saving"}
          className="rounded-lg bg-nx-accent px-4 py-2 text-sm font-medium text-white shadow-glow-sm disabled:opacity-60"
        >
          {status === "saving" ? "Speichern…" : "Speichern"}
        </button>
        {status === "saved" ? <p className="text-sm text-emerald-300">Gespeichert</p> : null}
        {status === "error" ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}
