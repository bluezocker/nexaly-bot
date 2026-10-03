import { API_URL } from "./config";

export type LeaderboardEntry = {
  rank: number;
  name: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  intoLevel: number;
  needed: number;
};

export type PublicLeaderboard = {
  guild: { name: string; iconUrl: string | null };
  total: number;
  entries: LeaderboardEntry[];
};

export type LeaderboardResult =
  | { status: "ok"; data: PublicLeaderboard }
  | { status: "not-found" }
  | { status: "error" };

/**
 * Lädt die öffentliche Rangliste. Das Ergebnis wird 30 Sekunden zwischengespeichert,
 * damit viele Seitenaufrufe die API nicht belasten.
 */
export async function loadPublicLeaderboard(guildId: string): Promise<LeaderboardResult> {
  if (!/^\d{17,20}$/.test(guildId)) return { status: "not-found" };
  try {
    const response = await fetch(`${API_URL}/v1/public/leaderboard/${guildId}`, { next: { revalidate: 30 } });
    if (response.status === 404) return { status: "not-found" };
    if (!response.ok) return { status: "error" };
    return { status: "ok", data: (await response.json()) as PublicLeaderboard };
  } catch {
    return { status: "error" };
  }
}
