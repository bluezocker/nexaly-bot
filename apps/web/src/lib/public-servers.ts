import { API_URL } from "./config";

export type PublicServer = {
  name: string;
  iconUrl: string | null;
  memberCount: number | null;
};

export async function loadPublicServers(): Promise<{ count: number; servers: PublicServer[]; error: string | null }> {
  try {
    const response = await fetch(`${API_URL}/v1/public/servers`, { cache: "no-store" });
    if (!response.ok) return { count: 0, servers: [], error: `API ${response.status}` };
    const json = (await response.json()) as { count?: number; servers?: PublicServer[] };
    return { count: json.count ?? json.servers?.length ?? 0, servers: json.servers ?? [], error: null };
  } catch (error) {
    return {
      count: 0,
      servers: [],
      error: error instanceof Error ? error.message : "Abruf fehlgeschlagen",
    };
  }
}