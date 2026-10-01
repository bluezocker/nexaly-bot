import { ApiBanner } from "@/lib/api-banner";
import { apiFetchSafe } from "@/lib/api";
import { StreamsForm } from "./streams-form";

export const dynamic = "force-dynamic";

type Payload = {
  subscriptions: {
    id: string;
    platform: string;
    channelKey: string;
    displayName: string;
    announceChannelId: string;
    mentionRoleId: string | null;
    enabled: boolean;
  }[];
  providers: Record<string, boolean>;
};

export default async function StreamsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const [data, channels, settings] = await Promise.all([
    apiFetchSafe<Payload>(`/v1/guilds/${guildId}/streams`, { subscriptions: [], providers: {} }),
    apiFetchSafe<{ channels: { id: string; name: string }[] }>(`/v1/guilds/${guildId}/channels`, {
      channels: [],
    }),
    apiFetchSafe<{ roles: { id: string; name: string }[] }>(`/v1/guilds/${guildId}/settings`, { roles: [] }),
  ]);
  return (
    <div>
      <ApiBanner error={data.error ?? channels.error ?? settings.error} />
      <StreamsForm
        guildId={guildId}
        subscriptions={data.data.subscriptions ?? []}
        providers={data.data.providers ?? {}}
        channels={channels.data.channels ?? []}
        roles={settings.data.roles ?? []}
      />
    </div>
  );
}
