import { cookies } from "next/headers";
import { API_URL, SESSION_COOKIE } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE)?.value;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (session) headers.set("Cookie", `${SESSION_COOKIE}=${session}`);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
  } catch (error) {
    throw new ApiError(503, "UNAVAILABLE", error instanceof Error ? error.message : "API nicht erreichbar");
  }
  if (!response.ok) {
    let code = "INTERNAL";
    let message = "Request failed";
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(response.status, code, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function apiFetchSafe<T>(path: string, fallback: T): Promise<{ data: T; error: string | null }> {
  try {
    return { data: await apiFetch<T>(path), error: null };
  } catch (error) {
    const message = error instanceof ApiError ? `${error.status}: ${error.message}` : "Unbekannter Fehler";
    return { data: fallback, error: message };
  }
}

export type Me = {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  avatarUrl: string | null;
};

export type ManageableGuild = {
  id: string;
  name: string;
  icon: string | null;
  iconUrl: string | null;
  botInstalled: boolean;
  accessReason: string;
  inviteUrl: string | null;
};

export type GuildDetails = {
  id: string;
  name: string;
  icon: string | null;
  ownerId: string;
  memberCount: number | null;
  botJoinedAt: string | null;
  modules: { key: string; enabled: boolean }[];
};
