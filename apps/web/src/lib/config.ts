export const API_URL = process.env.PUBLIC_API_URL ?? "http://localhost:3001";
export const WEB_URL = process.env.PUBLIC_WEB_URL ?? "https://nexaly.app";
export const SESSION_COOKIE = "nexaly_session";
export const OAUTH_STATE_COOKIE = "nexaly_oauth_state";
export const THREADS_STATE_COOKIE = "nexaly_threads_state";

export function publicPath(path: string): URL {
  return new URL(path, WEB_URL);
}
