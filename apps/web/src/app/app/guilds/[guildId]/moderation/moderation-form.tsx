"use client";

import { useState } from "react";

type Settings = {
  enabled: boolean;
  spamEnabled: boolean;
  spamMessages: number;
  spamWindowSec: number;
  duplicateEnabled: boolean;
  duplicateCount: number;
  mentionLimit: number;
  emojiLimit: number;
  capsPercent: number;
  capsMinLength: number;
  linkSpamLimit: number;
  inviteBlock: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
  raidEnabled: boolean;
  raidJoins: number;
  raidWindowSec: number;
  raidAction: "ALERT" | "LOCKDOWN" | "RESTRICT_NEW" | "VERIFY_GATE";
  raidAlertChannelId: string | null;
  minAccountAgeHours: number | null;
  logChannelId: string | null;
  ignoreRoleIds: string[];
  ignoreChannelIds: string[];
};

type Rule = {
  id: string;
  pattern: string;
  matchMode: string;
  action: string;
  type: string;
};

const defaults: Settings = {
  enabled: false,
  spamEnabled: true,
  spamMessages: 5,
  spamWindowSec: 5,
  duplicateEnabled: true,
  duplicateCount: 3,
  mentionLimit: 8,
  emojiLimit: 12,
  capsPercent: 80,
  capsMinLength: 12,
  linkSpamLimit: 4,
  inviteBlock: true,
  allowedDomains: [],
  blockedDomains: [],
  raidEnabled: false,
  raidJoins: 10,
  raidWindowSec: 15,
  raidAction: "ALERT",
  raidAlertChannelId: null,
  minAccountAgeHours: null,
  logChannelId: null,
  ignoreRoleIds: [],
  ignoreChannelIds: [],
};

export function ModerationForm(props: {
  guildId: string;
  enabled: boolean;
  settings: Partial<Settings> | null;
  rules: Rule[];
  ladder: { step: number; action: string; durationSec: number | null }[];
  cases: { caseNumber: number; action: string; targetId: string; reason: string | null }[];
}) {
  const [form, setForm] = useState<Settings>({ ...defaults, ...props.settings, enabled: props.enabled });
  const [allowed, setAllowed] = useState((props.settings?.allowedDomains ?? []).join(", "));
  const [blocked, setBlocked] = useState((props.settings?.blockedDomains ?? []).join(", "));
  const [rules, setRules] = useState(props.rules);
  const [pattern, setPattern] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function patch<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    setError(null);
    const body = {
      ...form,
      allowedDomains: allowed.split(",").map((s) => s.trim()).filter(Boolean),
      blockedDomains: blocked.split(",").map((s) => s.trim()).filter(Boolean),
      ladder: props.ladder.map((step) => ({
        step: step.step,
        action: step.action,
        durationSec: step.durationSec,
      })),
    };
    const response = await fetch(`/api/guilds/${props.guildId}/moderation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setStatus("error");
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(payload?.error?.message ?? "Speichern fehlgeschlagen");
      return;
    }
    setStatus("saved");
  }

  async function addRule() {
    if (!pattern.trim()) return;
    const response = await fetch(`/api/guilds/${props.guildId}/moderation/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "WORD",
        pattern: pattern.trim(),
        matchMode: "CONTAINS",
        action: "WARN",
        durationSec: null,
        enabled: true,
        exceptRoleIds: [],
        exceptChannelIds: [],
      }),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { rule: Rule };
    setRules((current) => [...current, payload.rule]);
    setPattern("");
  }

  async function removeRule(id: string) {
    await fetch(`/api/guilds/${props.guildId}/moderation/rules/${id}`, { method: "DELETE" });
    setRules((current) => current.filter((rule) => rule.id !== id));
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between rounded-2xl border border-nx-border bg-nx-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Moderation</h2>
          <p className="mt-1 text-sm text-nx-muted">
            Auto-Mod, Wortfilter, Raid-Schutz und Cases. Moderatoren können keine höheren Rollen treffen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => patch("enabled", !form.enabled)}
          className={`h-7 w-12 rounded-full ${form.enabled ? "bg-nx-accent" : "bg-nx-border"}`}
        />
      </section>

      <section className="grid gap-4 rounded-2xl border border-nx-border bg-nx-card p-5 sm:grid-cols-2">
        <Toggle label="Spam-Schutz" value={form.spamEnabled} onChange={(v) => patch("spamEnabled", v)} />
        <NumberField label="Nachrichten / Fenster" value={form.spamMessages} onChange={(v) => patch("spamMessages", v)} />
        <NumberField label="Fenster (Sek.)" value={form.spamWindowSec} onChange={(v) => patch("spamWindowSec", v)} />
        <Toggle label="Duplikate" value={form.duplicateEnabled} onChange={(v) => patch("duplicateEnabled", v)} />
        <NumberField label="Duplikat-Limit" value={form.duplicateCount} onChange={(v) => patch("duplicateCount", v)} />
        <NumberField label="Mention-Limit" value={form.mentionLimit} onChange={(v) => patch("mentionLimit", v)} />
        <NumberField label="Emoji-Limit" value={form.emojiLimit} onChange={(v) => patch("emojiLimit", v)} />
        <NumberField label="Caps %" value={form.capsPercent} onChange={(v) => patch("capsPercent", v)} />
        <NumberField label="Link-Limit" value={form.linkSpamLimit} onChange={(v) => patch("linkSpamLimit", v)} />
        <Toggle label="Invite-Schutz" value={form.inviteBlock} onChange={(v) => patch("inviteBlock", v)} />
        <label className="sm:col-span-2 text-sm">
          Erlaubte Domains
          <input className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2" value={allowed} onChange={(e) => setAllowed(e.target.value)} />
        </label>
        <label className="sm:col-span-2 text-sm">
          Blockierte Domains
          <input className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2" value={blocked} onChange={(e) => setBlocked(e.target.value)} />
        </label>
      </section>

      <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">Anti-Raid</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Toggle label="Aktiv" value={form.raidEnabled} onChange={(v) => patch("raidEnabled", v)} />
          <NumberField label="Joins" value={form.raidJoins} onChange={(v) => patch("raidJoins", v)} />
          <NumberField label="Fenster (Sek.)" value={form.raidWindowSec} onChange={(v) => patch("raidWindowSec", v)} />
          <label className="text-sm">
            Aktion
            <select
              className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2"
              value={form.raidAction}
              onChange={(e) => patch("raidAction", e.target.value as Settings["raidAction"])}
            >
              <option value="ALERT">Alarm</option>
              <option value="LOCKDOWN">Invites pausieren</option>
              <option value="RESTRICT_NEW">Neue Member timeouten</option>
              <option value="VERIFY_GATE">Junge Accounts kicken</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">Wortfilter</h3>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-nx-border bg-nx-elevated px-3 py-2 text-sm"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="verbotenes Wort"
          />
          <button type="button" onClick={() => void addRule()} className="rounded-lg bg-nx-accent px-3 py-2 text-sm">
            Hinzufügen
          </button>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between text-nx-muted">
              <span>
                {rule.pattern} · {rule.matchMode} · {rule.action}
              </span>
              <button type="button" onClick={() => void removeRule(rule.id)} className="text-red-300">
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-nx-border bg-nx-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-nx-muted">Letzte Cases</h3>
        {props.cases.length === 0 ? (
          <p className="mt-2 text-sm text-nx-muted">Keine Cases.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-nx-muted">
            {props.cases.map((item) => (
              <li key={item.caseNumber}>
                #{item.caseNumber} · {item.action} · {item.targetId} · {item.reason ?? "—"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={status === "saving"}
          className="rounded-xl bg-nx-accent px-4 py-2 text-sm font-semibold"
        >
          {status === "saving" ? "Speichert…" : "Speichern"}
        </button>
        <span className="text-sm text-nx-muted">
          {status === "saved" ? "Gespeichert" : status === "error" ? error : null}
        </span>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-sm">
      {label}
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="accent-[#7c5cff]" />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-sm">
      {label}
      <input
        type="number"
        className="mt-1 w-full rounded-lg border border-nx-border bg-nx-elevated px-3 py-2"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
