import { prisma } from "@nexaly/database";
import type { WelcomeModeName } from "@nexaly/shared";

export interface WelcomeRuntime {
  moduleEnabled: boolean;
  channelId: string | null;
  sendDm: boolean;
  dmTemplate: string | null;
  mode: WelcomeModeName;
  textTemplate: string | null;
  embedJson: { title?: string; description?: string; color?: number } | null;
  backgroundPath: string | null;
  textColor: string;
  accentColor: string;
  avatarX: number;
  avatarY: number;
  nameX: number;
  nameY: number;
  customText: string | null;
}

const cache = new Map<string, WelcomeRuntime>();

export function invalidateWelcomeConfig(guildId: string): void {
  cache.delete(guildId);
}

export async function getWelcomeConfig(guildId: string): Promise<WelcomeRuntime | null> {
  const cached = cache.get(guildId);
  if (cached) return cached;
  const [moduleRow, settings] = await Promise.all([
    prisma.guildModule.findUnique({ where: { guildId_key: { guildId, key: "welcome" } } }),
    prisma.welcomeSettings.findUnique({ where: { guildId } }),
  ]);
  if (!settings) return null;
  let backgroundPath: string | null = null;
  if (settings.backgroundAssetId) {
    const asset = await prisma.asset.findFirst({
      where: { id: settings.backgroundAssetId, guildId },
    });
    backgroundPath = asset?.storageKey ?? null;
  }
  const embed =
    settings.embedJson && typeof settings.embedJson === "object" && !Array.isArray(settings.embedJson)
      ? (settings.embedJson as WelcomeRuntime["embedJson"])
      : null;
  const runtime: WelcomeRuntime = {
    moduleEnabled: moduleRow?.enabled ?? settings.enabled,
    channelId: settings.channelId,
    sendDm: settings.sendDm,
    dmTemplate: settings.dmTemplate,
    mode: settings.mode,
    textTemplate: settings.textTemplate,
    embedJson: embed,
    backgroundPath,
    textColor: settings.textColor,
    accentColor: settings.accentColor,
    avatarX: settings.avatarX,
    avatarY: settings.avatarY,
    nameX: settings.nameX,
    nameY: settings.nameY,
    customText: settings.customText,
  };
  cache.set(guildId, runtime);
  return runtime;
}
