import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { loadPublicLeaderboard, type LeaderboardEntry } from "@/lib/public-leaderboard";

type Props = { params: Promise<{ guildId: string }> };

const number = new Intl.NumberFormat("de-DE");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { guildId } = await params;
  const result = await loadPublicLeaderboard(guildId);
  const title = result.status === "ok" ? `Rangliste · ${result.data.guild.name} · Nexaly` : "Rangliste · Nexaly";
  return {
    title,
    description:
      result.status === "ok" ? `Die aktivsten Mitglieder auf ${result.data.guild.name}.` : "Rangliste eines Discord-Servers.",
    // Namen von Mitgliedern sollen nicht in Suchmaschinen landen.
    robots: { index: false, follow: false },
  };
}

function Avatar({ entry, size }: { entry: { name: string; avatarUrl: string | null }; size: number }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-nx-elevated font-semibold text-nx-accent-soft"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {(Array.from(entry.name.trim())[0] ?? "?").toUpperCase()}
      {entry.avatarUrl ? (
        // Als Hintergrund über dem Buchstaben: Lädt das Bild nicht, bleibt der Buchstabe sichtbar.
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${entry.avatarUrl}")` }}
        />
      ) : null}
    </span>
  );
}

function Progress({ entry }: { entry: LeaderboardEntry }) {
  const percent = entry.needed > 0 ? Math.min(100, Math.round((entry.intoLevel / entry.needed) * 100)) : 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-nx-elevated"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={`${percent} % bis Level ${entry.level + 1}`}
    >
      <div className="h-full rounded-full bg-nx-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}

const medals = ["#f5c451", "#c9d1e3", "#d08a5b"];

export default async function LeaderboardPage({ params }: Props) {
  const { guildId } = await params;
  const result = await loadPublicLeaderboard(guildId);
  if (result.status === "not-found") notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-nx-border/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-full">
              <Image src="/logo.png" alt="" fill className="object-cover" sizes="36px" />
            </div>
            <span className="text-sm font-semibold tracking-wide">Nexaly</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/docs#levels" className="text-sm text-nx-muted hover:text-white">
              So gibt es XP
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        {result.status === "error" ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Rangliste</h1>
            <p className="mt-3 text-sm text-nx-muted">
              Die Rangliste konnte gerade nicht geladen werden. Versuch es in einer Minute noch einmal.
            </p>
          </>
        ) : (
          <Board data={result.data} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Board({ data }: { data: Extract<Awaited<ReturnType<typeof loadPublicLeaderboard>>, { status: "ok" }>["data"] }) {
  const top = data.entries.slice(0, 3);
  const rest = data.entries.slice(3);
  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar entry={{ name: data.guild.name, avatarUrl: data.guild.iconUrl }} size={64} />
        <div className="min-w-0">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-nx-accent-soft">Rangliste</p>
          <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{data.guild.name}</h1>
        </div>
      </div>
      <p className="mt-4 text-sm text-nx-muted">
        {data.total === 0
          ? "Auf diesem Server hat noch niemand XP gesammelt."
          : data.total > data.entries.length
            ? `Die besten ${data.entries.length} von ${number.format(data.total)} Mitgliedern mit XP.`
            : `${number.format(data.total)} ${data.total === 1 ? "Mitglied" : "Mitglieder"} mit XP.`}
      </p>

      {top.length > 0 ? (
        <ol className="mt-8 grid gap-3 sm:grid-cols-3">
          {top.map((entry, index) => (
            <li
              key={entry.rank}
              className="flex flex-col items-center rounded-2xl border bg-nx-card p-5 text-center"
              style={{ borderColor: `${medals[index]}66` }}
            >
              <span
                className="mb-3 rounded-full px-2.5 py-0.5 text-xs font-bold text-nx-bg"
                style={{ backgroundColor: medals[index] }}
              >
                Platz {entry.rank}
              </span>
              <Avatar entry={entry} size={72} />
              <p className="mt-3 w-full truncate font-semibold">{entry.name}</p>
              <p className="mt-1 text-sm text-nx-muted">
                Level {entry.level} · {number.format(entry.xp)} XP
              </p>
              <div className="mt-3 w-full">
                <Progress entry={entry} />
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {rest.length > 0 ? (
        <ol className="mt-3 divide-y divide-nx-border overflow-hidden rounded-2xl border border-nx-border bg-nx-card" start={4}>
          {rest.map((entry) => (
            <li key={entry.rank} className="flex items-center gap-3 px-4 py-3">
              <span className="w-8 shrink-0 text-right text-sm tabular-nums text-nx-muted">{entry.rank}</span>
              <Avatar entry={entry} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{entry.name}</p>
                <div className="mt-1.5 max-w-xs">
                  <Progress entry={entry} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold">Level {entry.level}</p>
                <p className="text-xs tabular-nums text-nx-muted">{number.format(entry.xp)} XP</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {data.total > 0 ? (
        <p className="mt-6 text-xs text-nx-muted">
          XP gibt es für Nachrichten auf dem Server. Der Balken zeigt den Fortschritt zum nächsten Level. Die Liste
          aktualisiert sich etwa jede Minute.
        </p>
      ) : null}
    </>
  );
}
