import { ApiBanner } from "@/lib/api-banner";
import { apiFetchSafe } from "@/lib/api";
import { LevelsForm } from "./levels-form";

export const dynamic = "force-dynamic";

type Payload = {
  enabled: boolean;
  settings: {
    xpMin: number;
    xpMax: number;
    cooldownSec: number;
    announceChannelId: string | null;
    stackRoles: boolean;
    ignoredChannelIds: string[];
    ignoredRoleIds: string[];
  } | null;
  rewards: { level: number; roleId: string }[];
  leaderboard: { userId: string; xp: number; level: number }[];
};

export default async function LevelsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const [data, channels] = await Promise.all([
    apiFetchSafe<Payload>(`/v1/guilds/${guildId}/levels`, {
      enabled: false,
      settings: null,
      rewards: [],
      leaderboard: [],
    }),
    apiFetchSafe<{ channels: { id: string; name: string }[] }>(`/v1/guilds/${guildId}/channels`, {
      channels: [],
    }),
  ]);

  return (
    <div>
      <ApiBanner error={data.error ?? channels.error} />
      <LevelsForm
        guildId={guildId}
        enabled={data.data.enabled}
        settings={data.data.settings}
        rewards={data.data.rewards ?? []}
        leaderboard={data.data.leaderboard ?? []}
        channels={channels.data.channels ?? []}
      />
    </div>
  );
}
