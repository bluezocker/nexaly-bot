import { DISCORD_API_BASE } from "@nexaly/shared";

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
}

export async function fetchGuildChannels(
  botToken: string,
  guildId: string,
): Promise<DiscordChannel[]> {
  const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Failed to list channels (${response.status})`), {
      statusCode: response.status === 403 ? 403 : 502,
    });
  }
  return (await response.json()) as DiscordChannel[];
}

export const TEXT_CHANNEL_TYPES = new Set([0, 5]);

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  managed: boolean;
  position: number;
  permissions: string;
}

export async function fetchGuildRoles(botToken: string, guildId: string): Promise<DiscordRole[]> {
  const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Failed to list roles (${response.status})`), {
      statusCode: response.status === 403 ? 403 : 502,
    });
  }
  return (await response.json()) as DiscordRole[];
}


const VIEW_CHANNEL = 1n << 10n;
const SEND_MESSAGES = 1n << 11n;
const EMBED_LINKS = 1n << 14n;
const ADMINISTRATOR = 1n << 3n;

type Overwrite = { id: string; type: number; allow: string; deny: string };

let cachedBotId: string | null = null;

async function botUserId(botToken: string): Promise<string> {
  if (cachedBotId) return cachedBotId;
  const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!response.ok) throw new Error("bot identity");
  const body = (await response.json()) as { id: string };
  cachedBotId = body.id;
  return body.id;
}

export async function missingEmbedPermissions(
  botToken: string,
  guildId: string,
  channelId: string,
): Promise<string[]> {
  const userId = await botUserId(botToken);
  const [channelRes, roles, memberRes] = await Promise.all([
    fetch(`${DISCORD_API_BASE}/channels/${channelId}`, { headers: { Authorization: `Bot ${botToken}` } }),
    fetchGuildRoles(botToken, guildId),
    fetch(`${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    }),
  ]);
  if (!channelRes.ok || !memberRes.ok) return ["Kanal ansehen"];
  const channel = (await channelRes.json()) as { guild_id?: string; permission_overwrites?: Overwrite[] };
  if (channel.guild_id && channel.guild_id !== guildId) return ["Kanal ansehen"];
  const member = (await memberRes.json()) as { roles: string[] };
  const everyone = roles.find((role) => role.id === guildId);
  let perms = BigInt(everyone?.permissions ?? "0");
  for (const roleId of member.roles) {
    const role = roles.find((item) => item.id === roleId);
    if (role) perms |= BigInt(role.permissions);
  }
  if ((perms & ADMINISTRATOR) === ADMINISTRATOR) return [];
  const overwrites = channel.permission_overwrites ?? [];
  const everyoneOverwrite = overwrites.find((overwrite) => overwrite.id === guildId);
  if (everyoneOverwrite) {
    perms &= ~BigInt(everyoneOverwrite.deny);
    perms |= BigInt(everyoneOverwrite.allow);
  }
  let allow = 0n;
  let deny = 0n;
  for (const roleId of member.roles) {
    const overwrite = overwrites.find((item) => item.type === 0 && item.id === roleId);
    if (!overwrite) continue;
    allow |= BigInt(overwrite.allow);
    deny |= BigInt(overwrite.deny);
  }
  perms &= ~deny;
  perms |= allow;
  const memberOverwrite = overwrites.find((overwrite) => overwrite.type === 1 && overwrite.id === userId);
  if (memberOverwrite) {
    perms &= ~BigInt(memberOverwrite.deny);
    perms |= BigInt(memberOverwrite.allow);
  }
  const missing: string[] = [];
  if ((perms & VIEW_CHANNEL) !== VIEW_CHANNEL) missing.push("Kanal ansehen");
  if ((perms & SEND_MESSAGES) !== SEND_MESSAGES) missing.push("Nachrichten senden");
  if ((perms & EMBED_LINKS) !== EMBED_LINKS) missing.push("Links einbetten");
  return missing;
}

function discordSendError(status: number, body: { code?: number } | null): Error {
  const code = body?.code;
  const message =
    code === 50001
      ? "Der Bot sieht diesen Kanal nicht. Im Kanal „Kanal ansehen“ erlauben."
      : code === 50013
        ? "Dem Bot fehlen in diesem Kanal Nachrichten senden oder Links einbetten."
        : `Discord hat die Nachricht abgelehnt (${status}${code ? `, Code ${code}` : ""}).`;
  return Object.assign(new Error(message), { statusCode: status === 403 ? 403 : 502 });
}
export async function sendChannelMessage(
  botToken: string,
  channelId: string,
  body: { content?: string; embeds?: Record<string, unknown>[]; allowed_mentions?: { parse: string[] } },
): Promise<string> {
  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const details = (await response.json().catch(() => null)) as { code?: number } | null;
    throw discordSendError(response.status, details);
  }
  const json = (await response.json()) as { id: string };
  return json.id;
}

export async function fetchChannelMessage(
  botToken: string,
  channelId: string,
  messageId: string,
): Promise<{ id: string } | null> {
  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw Object.assign(new Error(`Failed to read message (${response.status})`), {
      statusCode: response.status === 403 ? 403 : 502,
    });
  }
  return (await response.json()) as { id: string };
}

export async function sendChannelComponents(
  botToken: string,
  channelId: string,
  body: { content?: string; embeds?: Record<string, unknown>[]; components?: unknown[] },
): Promise<string> {
  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const details = (await response.json().catch(() => null)) as { code?: number } | null;
    throw discordSendError(response.status, details);
  }
  const json = (await response.json()) as { id: string };
  return json.id;
}

export async function addBotReaction(
  botToken: string,
  channelId: string,
  messageId: string,
  emoji: string,
): Promise<void> {
  const encoded = encodeURIComponent(emoji);
  const url = `${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}/reactions/${encoded}/@me`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { method: "PUT", headers: { Authorization: `Bot ${botToken}` } });
    if (response.ok || response.status === 204) return;
    if (response.status === 429 && attempt < 3) {
      const body = (await response.json().catch(() => null)) as { retry_after?: number } | null;
      const wait = Math.min(5000, Math.ceil((body?.retry_after ?? 1) * 1000));
      await new Promise((resolve) => setTimeout(resolve, wait));
      continue;
    }
    throw Object.assign(new Error(`Failed to add reaction (${response.status})`), {
      statusCode: response.status === 403 ? 403 : 502,
    });
  }
}

/** Rollen-IDs eines Mitglieds; leeres Array, wenn der Nutzer nicht (mehr) auf dem Server ist. */
export async function fetchMemberRoleIds(botToken: string, guildId: string, userId: string): Promise<string[]> {
  const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Discord member lookup failed: ${response.status}`);
  const member = (await response.json()) as { roles?: string[] };
  return member.roles ?? [];
}
